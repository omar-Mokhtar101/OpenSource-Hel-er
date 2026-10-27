import { CV_MAX_BYTES } from '@osh/contracts';
import { CvService } from './cv.service';

describe('CvService limits', () => {
  it('rejects a file over the size limit before touching storage', async () => {
    const service = new CvService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.upload('u1', {
        size: CV_MAX_BYTES + 1,
        buffer: Buffer.from('%PDF'),
        originalname: 'cv.pdf',
        mimetype: 'application/pdf',
      } as Express.Multer.File),
    ).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
  });
});
