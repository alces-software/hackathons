export type Quiz =
    | {
        type: 'true-false';
        question: string;
        correctAnswer: boolean;
        explanation: string;
    }
    | {
        type: 'text';
        question: string;
        correctAnswer: string;
        acceptedAnswers: string[];
        explanation: string;
    };

export type Lesson = {
    id: string;
    x: number;
    title: string;
    material: string[];
    quiz: Quiz;
};

export const level0Lessons: Lesson[] = [
    {
        id: 'headless-server',
        x: 210,
        title: 'What is a headless server?',
        material: [
            'A server is a computer that provides services to other computers over a network.',
            'A headless server runs without a monitor, keyboard, or mouse attached for everyday use. You can inspect the Level 0 VM remotely through SSH instead of opening a graphical console.'
        ],
        quiz: {
            type: 'true-false',
            question: 'You can inspect the Level 0 VM over SSH without a monitor attached to it.',
            correctAnswer: true,
            explanation: 'SSH lets you manage a headless machine remotely.'
        }
    },
    {
        id: 'operating-system',
        x: 650,
        title: 'What is an operating system?',
        material: [
            'An operating system, or OS, is the main software that manages a computer and gives applications a way to use its hardware.',
            'It manages running programs, memory, files, and devices such as disks and keyboards. On a Linux VM, cat /etc/os-release shows the installed distribution and version.'
        ],
        quiz: {
            type: 'text',
            question: 'Which file would you read to identify the VM’s Linux distribution and version?',
            correctAnswer: '/etc/os-release',
            acceptedAnswers: ['/etc/os-release', 'etc/os-release', 'os-release', 'cat /etc/os-release'],
            explanation: 'The /etc/os-release file identifies the installed Linux distribution and version.'
        }
    },
    {
        id: 'linux',
        x: 995,
        title: 'What is Linux?',
        material: [
            'Linux is a kernel: the core part of an operating system that helps software use the computer hardware.',
            'A Linux distribution, such as Ubuntu or Debian, combines the Linux kernel with other software to make a usable operating system. The Level 0 VM reports Debian GNU/Linux 12 in /etc/os-release.'
        ],
        quiz: {
            type: 'true-false',
            question: 'If /etc/os-release says Debian GNU/Linux 12, Debian is the VM’s Linux distribution.',
            correctAnswer: true,
            explanation: 'Debian is the distribution installed on the Level 0 VM.'
        }
    },
    {
        id: 'computer-parts',
        x: 1360,
        title: 'What are CPU, RAM and storage?',
        material: [
            'The CPU executes instructions. RAM temporarily holds the data and programs currently in use.',
            'Storage, such as an SSD or hard drive, keeps files even when the computer is turned off. On the VM, lscpu reports CPU details, free -h reports memory, and lsblk lists storage devices.'
        ],
        quiz: {
            type: 'text',
            question: 'Which command shows the VM’s total RAM in human-readable units?',
            correctAnswer: 'free -h',
            acceptedAnswers: ['free -h', 'free --human'],
            explanation: 'Use free -h, then read the total value on the Mem row.'
        }
    },
    {
        id: 'physical-virtual',
        x: 1750,
        title: 'What is the difference between a physical and virtual machine?',
        material: [
            'A physical machine is a real computer with its own hardware.',
            'A virtual machine, or VM, is a software-defined computer that runs on a physical host. Several VMs can share one host, each with assigned virtual CPUs, RAM, disk, and its own operating system. lscpu reports the CPUs visible inside the VM.'
        ],
        quiz: {
            type: 'true-false',
            question: 'The VM can report one assigned CPU even if its physical host has more CPU cores.',
            correctAnswer: true,
            explanation: 'The guest sees the virtual CPU allocation chosen for it, not every core on the host.'
        }
    },
    {
        id: 'remote-access',
        x: 1940,
        title: 'What are SSH, IP addresses and hostnames?',
        material: [
            'An IP address identifies where a device can be reached on a network. A hostname is a readable name that can point to an IP address.',
            'SSH, or Secure Shell, lets you log in securely to another computer. Use ssh very_beginner@10.151.0.67 to reach the Level 0 VM. Once connected, hostname shows its name and hostname -I shows its IP addresses.'
        ],
        quiz: {
            type: 'text',
            question: 'Which command connects as very_beginner to the Level 0 VM at 10.151.0.67?',
            correctAnswer: 'ssh very_beginner@10.151.0.67',
            acceptedAnswers: ['ssh very_beginner@10.151.0.67'],
            explanation: 'The ssh user@address form logs in as the named user at that IP address.'
        }
    },
    {
        id: 'boot',
        x: 2180,
        title: 'How does a computer boot?',
        material: [
            'After power on, firmware such as UEFI or BIOS starts the hardware and finds a device to boot from.',
            'A bootloader then loads the operating system kernel. The kernel starts system services and eventually lets you use the computer. The uptime command tells you how long the VM has been running since its last boot.'
        ],
        quiz: {
            type: 'text',
            question: 'Which command shows how long the VM has been running since its last boot?',
            correctAnswer: 'uptime',
            acceptedAnswers: ['uptime'],
            explanation: 'uptime reports the time since the operating system last booted.'
        }
    }
];

export const level1Lessons: Lesson[] = [
    {
        id: 'install-linux',
        x: 210,
        title: 'How do you install Linux onto a machine?',
        material: [
            'Choose a Linux distribution and download its installation image, usually an ISO file. On a physical computer, write the image to a bootable USB drive; for a virtual machine, attach the image as virtual media.',
            'In the Chapter 2 task, connect to the VM console through VNC and boot the attached Ubuntu Server ISO. Follow the installer, choose the VM disk and settings, then reboot into the installed system.'
        ],
        quiz: {
            type: 'text',
            question: 'What kind of file is attached to the VM to start the Ubuntu installer?',
            correctAnswer: 'ISO image',
            acceptedAnswers: ['ISO', 'ISO image', 'Ubuntu ISO', 'Ubuntu Server ISO', 'installer ISO'],
            explanation: 'The VM boots from the attached Ubuntu Server ISO image.'
        }
    },
    {
        id: 'storage-layout',
        x: 620,
        title: 'What are partitions, filesystems and mount points?',
        material: [
            'A partition is a region of a storage device. A filesystem, such as ext4, organises files and directories in that region.',
            'A mount point is the directory where a filesystem appears in the Linux directory tree. The Ubuntu installation needs a root filesystem mounted at /. A separate filesystem could be mounted at /home. Check the target VM disk before accepting storage changes in the installer.'
        ],
        quiz: {
            type: 'true-false',
            question: 'During Ubuntu installation, the root filesystem must be mounted at /.',
            correctAnswer: true,
            explanation: '/ is the root mount point of the installed Linux system.'
        }
    },
    {
        id: 'users-permissions',
        x: 1020,
        title: 'What are Linux users and permissions?',
        material: [
            'A user account identifies who is running a process or accessing files. Users can belong to groups, and the root account has administrative power.',
            'The Ubuntu installer asks you to create a user so you can sign in after reboot. That regular account is separate from root; authorised administrative commands can be run with sudo. File permissions control read, write, and execute access for the owner, group, and others.'
        ],
        quiz: {
            type: 'true-false',
            question: 'The regular user you create in the installer is automatically the root account.',
            correctAnswer: false,
            explanation: 'Your login account is separate from root; use sudo when administrative access is authorised.'
        }
    },
    {
        id: 'networking-ssh',
        x: 1420,
        title: 'How do you configure networking and SSH?',
        material: [
            'A Linux machine needs network settings such as an IP address, gateway and DNS. These can be supplied automatically by DHCP or configured manually.',
            'In the Chapter 2 task, ssh -N -L forwards a port on your Mac to the VNC console on ravage. This tunnel lets you view the VM installer; it does not install or enable an SSH server inside the Ubuntu guest. To accept SSH logins after installation, the guest needs OpenSSH Server and working network settings.'
        ],
        quiz: {
            type: 'true-false',
            question: 'The SSH tunnel used to view VNC automatically enables SSH logins inside the Ubuntu VM.',
            correctAnswer: false,
            explanation: 'The tunnel reaches the console on ravage; guest SSH is configured separately.'
        }
    },
    {
        id: 'packages-services',
        x: 1830,
        title: 'How do you install packages and manage services?',
        material: [
            'A package manager installs, updates and removes software. Ubuntu uses APT; other Linux distributions may use different package managers.',
            'A service is a program that runs in the background. If you choose OpenSSH Server in the Ubuntu installer, check it after reboot with systemctl status ssh. Ubuntu uses APT to install and update packages, including openssh-server if you add it later.'
        ],
        quiz: {
            type: 'true-false',
            question: 'If you select OpenSSH Server during installation, checking its service after reboot helps verify it is running.',
            correctAnswer: true,
            explanation: 'systemctl status ssh lets you inspect the service on the installed Ubuntu VM.'
        }
    },
    {
        id: 'verify-installation',
        x: 2140,
        title: 'How do you verify an installation meets a specification?',
        material: [
            'For this task, reboot the VM from its installed disk and sign in with the account you created. That confirms the installation reached a usable system.',
            'For a fuller specification, also check the OS version, disk layout, users, network settings, packages and services against the required values.'
        ],
        quiz: {
            type: 'true-false',
            question: 'Once the Ubuntu installer finishes, rebooting and signing in helps verify the installed VM works.',
            correctAnswer: true,
            explanation: 'A successful reboot and login confirm the new system can start and accept your account.'
        }
    }
];

export const level2Lessons: Lesson[] = [
    {
        id: 'infrastructure-automation',
        x: 210,
        title: 'What is infrastructure automation?',
        material: [
            'Infrastructure automation uses written instructions and tools to create, configure, and maintain machines, networks, and services.',
            'In the Chapter 3 task, you replace the manual Ubuntu install with an autoinstall configuration that records choices such as the user, storage layout, and SSH settings. The same instructions can be used to rebuild a VM consistently.'
        ],
        quiz: {
            type: 'text',
            question: 'What Ubuntu installer feature can replace repeated manual setup prompts when rebuilding the VM?',
            correctAnswer: 'Autoinstall',
            acceptedAnswers: ['autoinstall', 'Ubuntu autoinstall', 'autoinstall configuration', 'autoinstall config'],
            explanation: 'Ubuntu autoinstall reads a configuration that supplies installation choices in advance.'
        }
    },
    {
        id: 'automation-tools',
        x: 520,
        title: 'What are Bash scripts, cloud-init and Ansible?',
        material: [
            'A Bash script runs shell commands in order. Cloud-init can provide user-data to the Ubuntu installer; the installer processes the autoinstall settings. Cloud-init can also apply first-boot configuration. The autoinstall quickstart puts installation settings inside a user-data file.',
            'Ansible uses playbooks to describe a desired configuration and can apply it to machines over SSH after installation.'
        ],
        quiz: {
            type: 'text',
            question: 'Which tool can deliver the autoinstall user-data to the Ubuntu installer?',
            correctAnswer: 'cloud-init',
            acceptedAnswers: ['cloud-init', 'cloud init'],
            explanation: 'Canonical’s autoinstall quickstart supplies its configuration through cloud-init user-data.'
        }
    },
    {
        id: 'manual-automated',
        x: 840,
        title: 'What is the difference between manual and automated provisioning?',
        material: [
            'Provisioning means preparing a machine so it is ready to use. In Chapter 2, you made installer choices manually in the VNC console.',
            'In Chapter 3, an autoinstall configuration supplies those choices ahead of time. Automated provisioning reduces repeated work and makes installations easier to reproduce.'
        ],
        quiz: {
            type: 'true-false',
            question: 'Choosing Ubuntu installer options in VNC is manual provisioning; supplying an autoinstall file is automated provisioning.',
            correctAnswer: true,
            explanation: 'Autoinstall supplies the setup choices that you previously entered by hand.'
        }
    },
    {
        id: 'idempotency',
        x: 1160,
        title: 'What does idempotency mean?',
        material: [
            'An idempotent operation can be run more than once and still leave the system in the same intended state.',
            'For the VM rebuild, a repeatable setup should check whether resources already exist and avoid creating duplicate VMs or applying the same change again unnecessarily. A cleanup script can also check before trying to remove an already deleted resource.'
        ],
        quiz: {
            type: 'true-false',
            question: 'An idempotent VM setup should create another duplicate VM each time you run it.',
            correctAnswer: false,
            explanation: 'Rerunning an idempotent setup should leave one VM in the same intended state.'
        }
    },
    {
        id: 'configuration-management',
        x: 1480,
        title: 'What is configuration management?',
        material: [
            'Configuration management defines and maintains settings such as users, packages, files, and services on a system.',
            'Autoinstall handles the OS installation. After the rebuilt VM boots, a tool such as Ansible can keep its packages, files, users, and services aligned with a defined configuration over SSH.'
        ],
        quiz: {
            type: 'text',
            question: 'Which tool from this chapter could enforce packages and services on the rebuilt VM over SSH?',
            correctAnswer: 'Ansible',
            acceptedAnswers: ['Ansible'],
            explanation: 'Ansible can apply a declared configuration to the installed VM over SSH.'
        }
    },
    {
        id: 'version-control',
        x: 1800,
        title: 'Why is version control important?',
        material: [
            'Version control records changes to scripts and configuration files so a team can see what changed, who changed it, and why.',
            'Keep the VM setup scripts and autoinstall YAML in version control. You can review what changed between installs and restore a known working configuration if the rebuild breaks.'
        ],
        quiz: {
            type: 'true-false',
            question: 'Keeping the autoinstall YAML in version control helps you review and reproduce VM rebuilds.',
            correctAnswer: true,
            explanation: 'Version history records the configuration used for each rebuild.'
        }
    },
    {
        id: 'verify-identical',
        x: 2120,
        title: 'How do you verify two installations are configured identically?',
        material: [
            'After rebuilding, compare the result with the intended VM specification. Check the OS with cat /etc/os-release, CPU with lscpu, memory with free -h, and disks with lsblk.',
            'Also compare users, network settings, packages, and services. A completed installer alone does not prove the new VM has the requested configuration.'
        ],
        quiz: {
            type: 'true-false',
            question: 'A successful autoinstall run alone proves the rebuilt VM matches the intended specification.',
            correctAnswer: false,
            explanation: 'Check the installed VM’s OS, resources, users, network, packages, and services against the specification.'
        }
    }
];

export const levels = [
    { name: 'Computer Basics', lessons: level0Lessons },
    { name: 'Linux Setup', lessons: level1Lessons },
    { name: 'Infrastructure Automation', lessons: level2Lessons }
];
