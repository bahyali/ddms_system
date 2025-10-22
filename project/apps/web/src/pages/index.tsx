import Head from 'next/head';
import Link from 'next/link';
import styles from '~/styles/Home.module.css';

export default function Home() {
  return (
    <div className={styles.container}>
      <Head>
        <title>DDMS</title>
        <meta name="description" content="Dynamic Data Management System" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Welcome to DDMS
        </h1>

        <div className={styles.description}>
          <Link href="/admin/entity-types">
            <button>Manage Entity Types</button>
          </Link>
        </div>
      </main>
    </div>
  );
}