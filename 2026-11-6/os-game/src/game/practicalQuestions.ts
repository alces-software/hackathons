export type PracticalQuestion = {
    id: string;
    question: string;
    command: string;
    correctAnswer: string;
    acceptedAnswers: string[];
};

export const practicalQuestions: PracticalQuestion[] = [
    {
        id: 'os-release',
        question: 'What distribution and version does PRETTY_NAME report on the VM?',
        command: 'cat /etc/os-release',
        correctAnswer: 'Debian GNU/Linux 12 (bookworm)',
        acceptedAnswers: ['Debian GNU/Linux 12 (bookworm)', 'Debian GNU/Linux 12', 'Debian 12', 'Debian 12 bookworm']
    },
    {
        id: 'cpu-architecture',
        question: 'What value does lscpu show for Architecture?',
        command: 'lscpu',
        correctAnswer: 'x86_64',
        acceptedAnswers: ['x86_64', 'x86-64', 'amd64']
    },
    {
        id: 'cpu-model',
        question: 'What does lscpu list as the CPU model name?',
        command: 'lscpu',
        correctAnswer: 'AMD EPYC 73F3 16-Core Processor',
        acceptedAnswers: ['AMD EPYC 73F3 16-Core Processor', 'AMD EPYC 73F3', 'EPYC 73F3']
    },
    {
        id: 'total-ram',
        question: 'What is the total RAM in the Mem row of free -h? Do not use the used or available value.',
        command: 'free -h',
        correctAnswer: '988Mi',
        acceptedAnswers: ['988Mi', 'about 1 GiB', '1 GiB', '1 GB', 'about 1 GB']
    },
    {
        id: 'main-disk-size',
        question: 'What size does lsblk report for the vda disk, not one of its partitions?',
        command: 'lsblk',
        correctAnswer: '8G',
        acceptedAnswers: ['8G', '8 GB', '8 GiB']
    },
    {
        id: 'hostname',
        question: 'What name does the hostname command return for this VM?',
        command: 'hostname',
        correctAnswer: 'level0',
        acceptedAnswers: ['level0']
    },
    {
        id: 'other-ip',
        question: 'What IP address does hostname -I show besides 10.151.0.67?',
        command: 'hostname -I',
        correctAnswer: '10.0.0.1',
        acceptedAnswers: ['10.0.0.1']
    }
];

function normaliseAnswer(value: string)
{
    return value.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

export function isPracticalAnswerCorrect(question: PracticalQuestion, answer: string)
{
    const normalised = normaliseAnswer(answer);
    return question.acceptedAnswers.some((accepted) => normaliseAnswer(accepted) === normalised);
}
