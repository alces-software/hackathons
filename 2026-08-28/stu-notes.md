# Kubernetes on VMs

Using VMs and kubernetes to simulate closer to a cluster-style environment than using docker containers as the "hosts".

Creating VMs
```
mkdir -p /opt/vm/libvirt-kubernetes/

# Get image
wget -O /opt/vm/libvirt-kubernetes/rocky9-cloud.qcow2 https://download.rockylinux.org/pub/rocky/9/images/x86_64/Rocky-9-GenericCloud-Base.latest.x86_64.qcow2

# Fix console output of image (not sure if needed actually)
virt-customize -a  rocky9-cloud.qcow2  --run-command 'sed -i "s/GRUB_CMDLINE_LINUX=\"/GRUB_CMDLINE_LINUX=\"console=ttyS0,115200 /" /etc/default/grub' --run-command 'grub2-mkconfig -o /boot/grub2/grub.cfg --update-bls-cmdline'

# Create vm disks
for vm in k8s-cp k8s-cpu1 k8s-cpu2 k8s-gpu1; do
  qemu-img create -f qcow2 -F qcow2 -b /opt/vm/libvirt-kubernetes/rocky9-cloud.qcow2 /opt/vm/libvirt-kubernetes/${vm}.qcow2 20G
done

# Create cloud-init file (see Appendix A)
## /opt/vm/libvirt-kubernetes/user-data

# Create seeding script (see Appendix B)
## /opt/vm/libvirt-kubernetes/seed.sh

# Seed VMs
bash /opt/vm/libvirt-kubernetes/seed.sh

# Create VM launch script (see Appendix C)
## /opt/vm/libvirt-kubernetes/create.sh

# Create VMs
bash /opt/vm/libvirt-kubernetes/create.sh

# Wait ~5 mins for things to install dependencies and reboot
```

Get IPs of all the things
```
virsh net-dhcp-leases ext
```

Setup control plane
```
ssh rocky@EXT_IP

sudo su -

dnf install -y conntrack
kubeadm init --apiserver-advertise-address=EXT_IP --pod-network-cidr=10.244.0.0/16 --service-cidr=10.96.0.0/12
export KUBECONFIG=/etc/kubernetes/admin.conf
kubectl apply -f https://raw.githubusercontent.com/projectcalico/calico/v3.28.0/manifests/calico.yaml

# NFS server
echo '/scratch	*(rw,no_root_squash)' >> /etc/exports
systemctl enable nfs-server --now
exportfs -va

```

Setup compute nodes
```
JOIN_CMD=$(ssh rocky@EXT_IP_CP 'sudo kubeadm token create --print-join-command')
for i in 192.168.100.252 192.168.100.191 192.168.100.148 ; do ssh rocky@$i "sudo dnf -y install conntrack ; sudo $JOIN_CMD" ; done

# NFS client
## Add the following to /etc/fstab
## EXT_IP_CP:/scratch        /scratch        nfs     defaults        0 0
## Create /scratch dir
## mount -a
```

Extra control plane config
```
# Label systems with attributes
kubectl label nodes k8s-cp   node-role=infra
kubectl label nodes k8s-cpu1 node-role=compute node-type=cpu
kubectl label nodes k8s-cpu2 node-role=compute node-type=cpu
kubectl label nodes k8s-gpu1 node-role=compute node-type=gpu
kubectl taint nodes k8s-gpu1 node-type=gpu:NoSchedule

# Create a namespace for HPC job containers
kubectl create namespace hpc-jobs

```

On local system / system with 'kubectl' command (e.g. this is the login node or something that is gonna configure/submit jobs)

## Checking things

Show that the control plane can only do control plane things (so containers submitted explicitly with taint for it) and GPU is set with it's own taint
```
kubectl get nodes -o custom-columns=NAME:.metadata.name,TAINTS:.spec.taints
```

## Running a job

Note: Kubernetes has explicitly got things called "jobs" that create "pods" (containers), we're utilising that.

Setup user to submit jobs
```
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config
```

Create job definition (see Appendix D: FastQC Job)
- Worth looking at nodeSelector and resources sections to see how that relates to traditional scheduler-like setup
- Worth looking at the fetch-data "initContainer" -> quite a standard way of going "get some data in" before then running the workload

Submit job
```
kubectl apply -f fastqc-job.yaml
```

Check on "queue"
```
$ kubectl get jobs -n hpc-jobs
NAME                STATUS    COMPLETIONS   DURATION   AGE
fastqc-sample-001   Running   0/1           8s         8s
```

Check on "pods" for "jobs"
```
$ kubectl get pods -n hpc-jobs -o wide
NAME                      READY   STATUS              RESTARTS   AGE   IP       NODE       NOMINATED NODE   READINESS GATES
fastqc-sample-001-2mgd2   0/1     ContainerCreating   0          12s   <none>   k8s-cpu2   <none>           <none>
```

Follow job progress
```
$ kubectl logs -n hpc-jobs -f job/fastqc-sample-001
Defaulted container "fastqc" out of: fastqc, fetch-data (init)
=== FASTQC Job Starting ===
Node: fastqc-sample-003-ms79x
Date: Fri Aug 28 15:11:55 UTC 2026
Input: total 308
drwxrwxrwx    2 root     root            26 Aug 28 15:11 .
drwxr-xr-x    1 root     root            54 Aug 28 15:11 ..
-rw-r--r--    1 root     root        313893 Aug 28 15:11 sample.fastq

Running FastQC...
null
Started analysis of sample.fastq
Approx 100% complete for sample.fastq
Analysis complete for sample.fastq

=== Job Complete ===
total 796
drwxrwxrwx    2 root     root            57 Aug 28 15:11 .
drwxr-xr-x    1 root     root            88 Aug 28 15:11 ..
-rw-r--r--    1 root     root        528367 Aug 28 15:11 sample_fastqc.html
-rw-r--r--    1 root     root        284471 Aug 28 15:11 sample_fastqc.zip
```

View job results
```
ls /scratch/rocky/fastqc-results
```

## Appendix A: Cloud Init

```
#cloud-config
# This runs on EVERY VM on first boot

# Set hostname (overridden per-VM below)
hostname: k8s-node

# SSH key (so you can SSH in from the host)
ssh_authorized_keys:
  - ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQCUfq6FlFub/U4PWx+ktB6TrpqMUeE1BZLDqYX+AHNSZ6PgOCMRU8DDYbxPU+dieUr1Qf1KJG/7kBZZLLHq0eEC27CirSGaJTUfHgkQciEVFJXTFmrRflRvAP+2DXaEfqseGAA7kFiTbBK1qNsruI8M1fS2Oe0KVMPi8vJe8pk6Ez4weuZg3OBvQdNqGHtl1eCOCMy89bLSv4CsEm2MRrNsiOHH7hSd6CD0tzP3CWe6RUtUx+03M6Wbv8SKGIoxdIQccci3AIH4oC3I037XKeJ3NTfrfv9MPrqwiwe5bZ1sVYYdiZo+zUDaoM8rYGjAfZWp78aSGRzOzjtCAFkMn5/C8170sz9bY4V4mVuGQvuEYenSfdhyq5ZRntk1CDSQ8N4zJLtdwM/TbHspstDWAYSzpEjT8yNY4xi7605Q5LOhJV24B1jdgRsxktYPotaPxk3b020rgQSiVb3Jpax50CVMv9dkYtlzN4ox91JjNbHw/jmG1DmuEncLLTJkXzTvFBM= root@baremetaltest.novalocal

# Disable swap
bootcmd:
  - swapoff -a
  - sed -i '/swap/d' /etc/fstab

# Kernel modules
write_files:
  - path: /etc/modules-load.d/k8s.conf
    content: |
      overlay
      br_netfilter

  - path: /etc/sysctl.d/k8s.conf
    content: |
      net.bridge.bridge-nf-call-iptables = 1
      net.bridge.bridge-nf-call-ip6tables = 1
      net.ipv4.ip_forward = 1

  - path: /etc/yum.repos.d/kubernetes.repo
    content: |
      [kubernetes]
      name=Kubernetes
      baseurl=https://pkgs.k8s.io/core:/stable:/v1.31/rpm/
      enabled=1
      gpgcheck=1
      gpgkey=https://pkgs.k8s.io/core:/stable:/v1.31/rpm/repodata/repomd.xml.key

# Install packages
packages:
  - containerd.io
  - kubelet
  - kubeadm
  - kubectl

package_update: true

# Containerd repo (Docker's repo for containerd.io)
yum_repos:
  docker-ce:
    name: Docker CE
    baseurl: https://download.docker.com/linux/centos/$releasever/$basearch/stable
    enabled: true
    gpgcheck: true
    gpgkey: https://download.docker.com/linux/centos/gpg

# Configure and start services
runcmd:
  # Load kernel modules now
  - modprobe overlay
  - modprobe br_netfilter
  - sysctl --system

  # Configure containerd
  - containerd config default | tee /etc/containerd/config.toml
  - sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml
  - systemctl enable containerd --now

  # Enable kubelet (it won't start properly until kubeadm init/join runs, that's fine)
  - systemctl enable kubelet

  # Set SELinux to permissive (kubeadm requirement unless you've configured it properly)
  - setenforce 0
  - sed -i 's/^SELINUX=enforcing/SELINUX=permissive/' /etc/selinux/config

  # Disable firewall (simplest for a lab — in prod you'd configure it properly)
  - systemctl disable firewalld --now

# Reboot after setup to apply everything cleanly
power_state:
  mode: reboot
  message: "Rebooting after k8s base setup"
  timeout: 10
```

## Appendix B: Seed VMs

```
create_vm_seed() {
  local VM_NAME=$1
  local VM_IP=$2
  local VM_HOSTNAME=$3
  local SEED_DIR="/opt/vm/libvirt-kubernetes/${VM_NAME}"

  mkdir -p "$SEED_DIR"

  # Override hostname and set static IP via network-config
  cat > "$SEED_DIR/meta-data" << EOF
instance-id: ${VM_NAME}
local-hostname: ${VM_HOSTNAME}
EOF

  # Copy user-data (same for all VMs)
  cp /opt/vm/libvirt-kubernetes/user-data "$SEED_DIR/user-data"

  # Create the cloud-init ISO
  genisoimage -output "/opt/vm/libvirt-kubernetes/${VM_NAME}-seed.iso" \
    -volid cidata -joliet -rock \
    "$SEED_DIR/user-data" "$SEED_DIR/meta-data" 
}

# Create seeds for all 4 VMs
create_vm_seed "k8s-cp"   "192.168.122.10" "k8s-cp"
create_vm_seed "k8s-cpu1" "192.168.122.11" "k8s-cpu1"
create_vm_seed "k8s-cpu2" "192.168.122.12" "k8s-cpu2"
create_vm_seed "k8s-gpu1" "192.168.122.13" "k8s-gpu1"
```

## Appendix C: VM Launch
```
#!/bin/bash

IMAGES=/opt/vm/libvirt-kubernetes
SEEDS=/opt/vm/libvirt-kubernetes

launch_vm() {
  local NAME=$1
  local VCPU=$2
  local RAM=$3
  local DISK="${IMAGES}/${NAME}.qcow2"
  local SEED="${SEEDS}/${NAME}-seed.iso"

  virt-install \
    --name "$NAME" \
    --vcpus "$VCPU" \
    --memory "$RAM" \
    --disk "$DISK,bus=virtio" \
    --disk "$SEED,device=cdrom" \
    --os-variant rocky9 \
    --network network=ext \
    --graphics none \
    --noautoconsole \
    --import \
    --boot uefi
}

mkdir -p $IMAGES

#         Name       vCPU  RAM(MB)
launch_vm "k8s-cp"   2     3072
launch_vm "k8s-cpu1" 4     4096
launch_vm "k8s-cpu2" 4     4096
launch_vm "k8s-gpu1" 8     8192

echo "All VMs launched. Waiting for cloud-init to finish (~3-5 min)..."
echo "Check progress: virsh console k8s-cp"
```

## Appendix D: FastQC Job
```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: fastqc-sample-005
  namespace: hpc-jobs
spec:
  backoffLimit: 2
  activeDeadlineSeconds: 300

  template:
    spec:
      nodeSelector:
        node-type: cpu
      restartPolicy: Never

      initContainers:
      - name: fetch-data
        image: busybox:latest
        command:
        - /bin/sh
        - -c
        - |
          echo "Generating synthetic FASTQ data..."
          for i in $(seq 1 1000); do
            echo "@READ_${i}"
            cat /dev/urandom | tr -dc 'ACGT' | head -c 150
            echo ""
            echo "+"
            head -c 150 /dev/zero | tr '\0' 'I'
            echo ""
          done > /scratch/sample.fastq

          echo "Generated: $(wc -l < /scratch/sample.fastq) lines"
        volumeMounts:
        - name: user-scratch
          mountPath: /scratch
      # ...

      containers:
      - name: fastqc
        image: quay.io/biocontainers/fastqc:0.12.1--hdfd78af_0
        command:
        - /bin/sh
        - -c
        - |
          echo "=== FASTQC Job Starting ==="
          echo "Node: $(hostname)"
          echo "User: $(whoami)"
          echo "Running FastQC..."
          fastqc /scratch/sample.fastq -o /scratch/results/fastqc-005 --noextract
          echo "Results written to /scratch/results/fastqc-005/"
          ls -la /scratch/results/fastqc-005/

        resources:
          requests:
            cpu: 1
            memory: 1Gi
          limits:
            cpu: 2
            memory: 2Gi

        volumeMounts:
        - name: user-scratch
          mountPath: /scratch

      volumes:
      - name: user-scratch
        hostPath:
          path: /scratch/rocky/fastqc-results    # This is the node's local view of the NFS mount
          type: DirectoryOrCreate
```
