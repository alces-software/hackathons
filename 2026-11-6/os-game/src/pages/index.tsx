import Head from 'next/head';
import dynamic from 'next/dynamic';

const GameApp = dynamic(() => import('@/App'), { ssr: false });

export default function Home()
{
    return (
        <>
            <Head>
                <title>OS Ascension</title>
                <meta name="description" content="Learn operating systems and automation in a dark fantasy Phaser platformer" />
            </Head>
            <GameApp />
        </>
    );
}
