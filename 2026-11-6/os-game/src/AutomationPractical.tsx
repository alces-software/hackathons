import { useState } from 'react';
import { level2Complete } from './game/progress';
import TerminalLauncher from './TerminalLauncher';

const vmName = 'level1-test';
const diskPath = '/home/rnd/home/vm/level1-test.qcow2';
const virtInstallLines = [
    'virt-install',
    '  --name level1-test',
    '  --memory 2048',
    '  --vcpus 2',
    '  --disk path=/home/rnd/home/vm/level1-test.qcow2,format=qcow2,bus=virtio',
    '  --cdrom /home/rnd/home/vm/ubuntu-24.04.3-live-server-amd64.iso',
    '  --network bridge=ext,model=virtio',
    '  --graphics vnc,listen=127.0.0.1,password=Level1',
    '  --os-variant ubuntu24.04',
    '  --boot cdrom,hd',
    '  --noautoconsole'
];
const virtInstallCommand = virtInstallLines
    .map((line, index) => line + (index < virtInstallLines.length - 1 ? ' ' + '\\' : ''))
    .join('\n');

const flagDetails = [
    { flag: '--name level1-test', meaning: 'Names the virtual machine level1-test in libvirt.' },
    { flag: '--memory 2048', meaning: 'Allocates 2048 MiB, or 2 GiB, of RAM to the VM.' },
    { flag: '--vcpus 2', meaning: 'Gives the VM two virtual CPUs.' },
    { flag: '--disk path=…,format=qcow2,bus=virtio', meaning: 'Attaches the QCOW2 disk image at the listed path using a VirtIO disk bus. Because no size is given, the disk image must already exist.' },
    { flag: '--cdrom …ubuntu-24.04.3…iso', meaning: 'Attaches the Ubuntu Server 24.04.3 installer ISO as virtual installation media.' },
    { flag: '--network bridge=ext,model=virtio', meaning: 'Connects the VM to the host bridge named ext with a VirtIO network adapter.' },
    { flag: '--graphics vnc,listen=127.0.0.1,password=Level1', meaning: 'Offers a VNC console bound to the host loopback address and protected by the listed password. No port is specified, so libvirt assigns an available VNC port.' },
    { flag: '--os-variant ubuntu24.04', meaning: 'Selects Ubuntu 24.04 guest settings so virt-install can choose suitable defaults.' },
    { flag: '--boot cdrom,hd', meaning: 'Sets the boot order to CD-ROM first, then hard disk.' },
    { flag: '--noautoconsole', meaning: 'Starts without automatically opening or attaching to the VM console.' }
];

export default function AutomationPractical()
{
    const [unlocked] = useState(level2Complete);

    if (!unlocked)
    {
        return (
            <main className="practical-page automation-page">
                <a className="back-link" href="/">← Back to game</a>
                <section className="practical-instructions">
                    <h1>Automation trial locked</h1>
                    <p>Complete the seven Chapter 3 lessons to open this practical test.</p>
                </section>
            </main>
        );
    }

    return (
        <main className="practical-page automation-page">
            <a className="back-link" href="/">← Back to game</a>
            <header className="practical-header">
                <span>Chapter 03 · Automation trial</span>
                <h1>Rebuild by automation</h1>
                <p>Study how the Chapter 2 VM was created, remove that test VM, then use the Ubuntu autoinstall guides to plan its automated replacement.</p>
            </header>

            <section className="practical-quiz automation-section" aria-labelledby="original-vm-title">
                <span className="quiz-counter">PHASE 01 // REVIEW</span>
                <h2 id="original-vm-title">How the VM was created</h2>
                <p>This is the original <code>virt-install</code> command used for <code>{vmName}</code>. Review it before removing the VM.</p>
                <pre className="command-block"><code>{virtInstallCommand}</code></pre>
                <p className="command-note">This command expects the disk file to exist already, and the VNC port was chosen automatically. It is shown for study; after deleting the disk image, it cannot be rerun unchanged.</p>
            </section>

            <section className="practical-quiz automation-section" aria-labelledby="flags-title">
                <span className="quiz-counter">PHASE 02 // DECODE</span>
                <h2 id="flags-title">What each flag means</h2>
                <dl className="flag-list">
                    {flagDetails.map(({ flag, meaning }) => (
                        <div className="flag-row" key={flag}>
                            <dt><code>{flag}</code></dt>
                            <dd>{meaning}</dd>
                        </div>
                    ))}
                </dl>
            </section>

            <div className="practical-layout automation-cleanup">
                <section className="practical-instructions" aria-labelledby="cleanup-title">
                    <span className="quiz-counter">PHASE 03 // REMOVE THE TEST VM</span>
                    <h2 id="cleanup-title">Start from a clean slate</h2>
                    <p>Connect to the virtualization host, then run these commands there. Confirm the VM name is <code>{vmName}</code> and its disk is <code>{diskPath}</code> before removing them.</p>
                    <ol className="challenge-steps">
                        <li>From your Mac, connect to the host: <code>ssh rnd@ravage</code></li>
                        <li>On <code>ravage</code>, stop the VM: <code>virsh destroy level1-test</code>. This powers it off immediately; if it is already off, continue to the next step.</li>
                        <li>Remove its libvirt definition: <code>virsh undefine level1-test</code>.</li>
                        <li>Remove its disk image: <code>rm /home/rnd/home/vm/level1-test.qcow2</code>.</li>
                        <li>Verify the VM is absent: <code>virsh list --all</code>. Check that <code>level1-test</code> no longer appears.</li>
                        <li>Verify the disk is absent: <code>test ! -e /home/rnd/home/vm/level1-test.qcow2 &amp;&amp; echo 'Disk removed'</code>.</li>
                    </ol>
                    <p>If <code>virsh undefine</code> reports an NVRAM file, use <code>virsh undefine --nvram level1-test</code> for this VM before removing the disk.</p>
                </section>
                <TerminalLauncher
                    title="Open your Mac terminal"
                    description="Terminal.app opens automatically. Use it to SSH into ravage; the cleanup commands run on ravage."
                    successMessage="Terminal.app opened. Check the target VM name before removing it."
                />
            </div>

            <section className="practical-quiz automation-section" aria-labelledby="autoinstall-title">
                <span className="quiz-counter">PHASE 04 // AUTOMATE</span>
                <h2 id="autoinstall-title">Use Ubuntu autoinstall</h2>
                <p>Use the official guides to create an autoinstall configuration for a fresh Ubuntu VM. Start with the quickstart, then use the reference when you need a setting or its exact YAML format.</p>
                <div className="resource-links">
                    <a href="https://canonical-subiquity.readthedocs-hosted.com/en/latest/howto/autoinstall-quickstart.html" target="_blank" rel="noopener noreferrer">
                        <strong>Autoinstall quick start</strong>
                        <span>Walk through an automated Ubuntu VM installation ↗</span>
                    </a>
                    <a href="https://canonical-subiquity.readthedocs-hosted.com/en/latest/reference/autoinstall-reference.html" target="_blank" rel="noopener noreferrer">
                        <strong>Autoinstall reference</strong>
                        <span>Look up configuration keys and examples ↗</span>
                    </a>
                </div>
            </section>
        </main>
    );
}
