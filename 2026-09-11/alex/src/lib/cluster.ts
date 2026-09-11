import { ps } from 'docker-compose';
import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

import { pathToCluster } from './paths.js';

/**
 * The options that are available within a cluster
 */
export type ClusterOptions = {
   cpus: number;
   database: boolean;
   memory: number;
   module: string;
   name: string;
   nodes: number;
   port: number;
};

/**
 * An instance of a cluster used for management and control
 */
export default class Cluster {
   public readonly name: string;
   public readonly path: string;
   private options: ClusterOptions | undefined;

   /**
    * Create's the cluster class
    * @param name The name of the cluster
    */
   constructor(name: string) {
      this.name = name;
      this.path = pathToCluster(name);
      this.options = this.readInfo();
   }

   /**
    * Creates the SSH connection information for the cluster
    * @returns The SSH connection information
    */
   connectionInfo(): {
      host: string;
      port: number;
      privateKey: string;
      username: string;
   } {
      return {
         host: 'localhost',
         port: this.options?.port ?? 2200,
         privateKey: path.join(this.path, 'cluster_key'),
         username: 'dev'
      };
   }

   /**
    * Destroys the cluster, removes it's files and deletes it's images
    */
   async destroy() {
      Bun.spawn(
         ["tac", "destroy", this.name], {
         stdin: "ignore",
         stdout: "pipe",
         stderr: "pipe",
      })
   }


   /**
    * Returns all the options from the cluster
    * @returns The clusters information
    */
   dumpInfo(): ClusterOptions | undefined {
      return this.options;
   }

   /**
    * Checks whether the clusters exists or not
    * @returns {boolean} Whether ot not the clusters exists
    */
   exists(): boolean {
      return this.options !== undefined;
   }

   /**
    * Checks whether or not all the containers in a cluster is running
    * @returns Whether or not the cluster is running
    */
   async isUp(): Promise<boolean> {
      try {
         const clusterInformation = await ps({ cwd: this.path });

         return clusterInformation.data.services.some(
            (service) => service.state.toLowerCase() !== 'up'
         );
      } catch {
         return false;
      }
   }

   /**
    * Reads the cluster information from it's JSON file
    * @returns {ClusterOptions | undefined} The cluster options
    */
   readInfo(): ClusterOptions | undefined {
      try {
         return (
            (JSON.parse(
               readFileSync(path.join(this.path, 'info.json'), 'utf8')
            ) as ClusterOptions) ?? undefined
         );
      } catch {
         return undefined;
      }
   }

   /**
    * Creates a new cluster
    */
   create(nodes: number) {
      Bun.spawn(["tac", "cluster:create", `--name=${this.name}`, `--nodes=${nodes}`], {
         stdin: "ignore",
         stdout: "pipe",
         stderr: "pipe",
      });
   }

   /**
    * Starts up the cluster
    */
   start() {
      Bun.spawn(
         ["tac", "cluster:start", this.name], {
         stdin: "ignore",
         stdout: "pipe",
         stderr: "pipe",
      })
   }

   /**
    * Stop the cluster
    */
   stop() {
      Bun.spawn(
         ["tac", "cluster:stop", this.name], {
         stdin: "ignore",
         stdout: "pipe",
         stderr: "pipe",
      })
   }
}
