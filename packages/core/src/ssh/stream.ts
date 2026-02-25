import { Client } from 'ssh2';

export class SSHStream {
    // This class could contain specialized logic for file uploads (SFTP) 
    // or complex interactive shell handling if needed later.
    // For now, simple exec streaming is handled in SSHClient.
    // We will implement SFTP upload here.

    static async uploadFile(client: Client, localPath: string, remotePath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            client.sftp((err, sftp) => {
                if (err) return reject(err);

                sftp.fastPut(localPath, remotePath, (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
        });
    }
}
