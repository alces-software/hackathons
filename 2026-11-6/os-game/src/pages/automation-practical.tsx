import Head from 'next/head';
import dynamic from 'next/dynamic';

const AutomationPractical = dynamic(() => import('@/AutomationPractical'), { ssr: false });

export default function AutomationPracticalPage()
{
    return (
        <>
            <Head>
                <title>Automation Trial | OS Ascension</title>
                <meta name="description" content="Chapter 3 VM automation practical test" />
            </Head>
            <AutomationPractical />
        </>
    );
}
