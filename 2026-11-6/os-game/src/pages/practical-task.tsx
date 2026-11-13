import Head from 'next/head';
import dynamic from 'next/dynamic';

const PracticalTask = dynamic(() => import('@/PracticalTask'), { ssr: false });

export default function PracticalTaskPage()
{
    return (
        <>
            <Head>
                <title>Practical Task | OS Ascension</title>
                <meta name="description" content="Inspect your Linux VM using Terminal.app" />
            </Head>
            <PracticalTask />
        </>
    );
}
