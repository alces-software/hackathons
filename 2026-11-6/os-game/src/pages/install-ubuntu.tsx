import Head from 'next/head';
import dynamic from 'next/dynamic';

const InstallUbuntuTask = dynamic(() => import('@/InstallUbuntuTask'), { ssr: false });

export default function InstallUbuntuPage()
{
    return (
        <>
            <Head>
                <title>Install Ubuntu | OS Ascension</title>
                <meta name="description" content="Chapter 2 Ubuntu installation challenge" />
            </Head>
            <InstallUbuntuTask />
        </>
    );
}
