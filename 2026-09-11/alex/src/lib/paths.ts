import envPaths from 'env-paths';
import path from 'node:path';

/**
 * Gets the path to the cluster folder created by the CLI
 * @param name The name of the cluster
 * @returns The completed path
 */
export function pathToCluster(name?: string): string {
   return path.join(envPaths('tac').data, name ?? '');
}
