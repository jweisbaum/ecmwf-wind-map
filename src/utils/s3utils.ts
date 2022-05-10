import { promises as fs, createReadStream } from 'fs';
import stream from 'stream';
import * as path from 'path';
import { S3 } from 'aws-sdk';

const s3 = new S3({
  accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
});

async function getFiles(dir: string): Promise<string | string[]> {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    dirents.map((dirent) => {
      const res = path.resolve(dir, dirent.name);
      return dirent.isDirectory() ? getFiles(res) : res;
    }),
  );
  return Array.prototype.concat(...files);
}

async function uploadFolderToS3(
  folderToUpload: string,
  options: { bucket: string; basePath: string },
) {
  const { bucket, basePath } = options;

  const files = (await getFiles(folderToUpload)) as string[];
  const uploads = files.map((filePath) =>
    s3
      .putObject({
        Key: `${basePath}/${path.relative(folderToUpload, filePath)}`,
        Bucket: bucket,
        Body: createReadStream(filePath),
      })
      .promise(),
  );
  return Promise.all(uploads);
}

function uploadStreamToS3(
  bucket: string,
  key: string,
): {
  writeStream: stream.PassThrough;
  uploadPromise: Promise<S3.ManagedUpload.SendData>;
} {
  const passThrough = new stream.PassThrough();

  const uploadPromise = s3
    .upload({
      Bucket: bucket,
      Key: key,
      Body: passThrough,
    })
    .promise();

  return { writeStream: passThrough, uploadPromise };
}

export { uploadFolderToS3, uploadStreamToS3 };
