import Dockerode from 'dockerode';

/**
 * Checks whether or not docker is running on the system
 * @returns Whether or not docker is running
 */
export async function dockerUp(): Promise<boolean> {
   try {
      await new Dockerode().ping();
      return true;
   } catch {
      return false;
   }
}
