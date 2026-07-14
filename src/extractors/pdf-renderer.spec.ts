import test from "ava";
import { renderPdfToImages } from "./pdf-renderer.js";

const tinyPdfBase64 = "JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDMgMCBSL0ZpbHRlci9GbGF0ZURlY29kZT4+CnN0cmVhbQp4nDPQM1Qo5ypUMFAwALJMLY31jBQsTAz1DBSUcpUi3d21VDU1zYxNNfUtzYyMQAK+xUoaXkE+RToKBUDaMzi/qDg1r0QhPbWIoR1I2oAAAwA1fBVjCmVuZHN0cmVhbQplbmRvYmoKCjMgMCBvYmoKNzgKZW5kb2JqCgo0IDAgb2JqCjw8L1R5cGUvUGFnZS9NZWRpYUJveFswIDAgNTk1LjI3NiA4NDEuODldL1Jlc291cmNlczw8L0ZvbnQ8PC9GMSA1IDAgUj4+Pj4vQ29udGVudHMgMiAwIFIvUGFyZW50IDYgMCBSPj4KZW5kb2JqCgo1IDAgb2JqCjw8L1R5cGUvRm9udC9TdWJ0eXBlL1R5cGUxL0Jhc2VGb250L0hlbHZldGljYT4+CmVuZG9iagoKNiAwIG9iago8PC9UeXBlL1BhZ2VzL0NvdW50IDEvS2lkc1s0IDAgUl0+PgplbmRvYmoKCjcgMCBvYmoKPDwvVHlwZS9DYXRhbG9nL1BhZ2VzIDYgMCBSPj4KZW5kb2JqCgoxIDAgb2JqCjw8L0NyZWF0b3IoRGVib25haXIpL1Byb2R1Y2VyKERlYm9uYWlyKS9DcmVhdGlvbkRhdGUoRDoyMDI0MDUwNjAwMDAwMFopPj4KZW5kb2JqCgp4cmVmCjAgOAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDA0MDYgMDAwMDAgbiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMTQ4IDAwMDAwIG4gCjAwMDAwMDAxNjcgMDAwMDAgbiAKMDAwMDAwMDI3MSAwMDAwMCBuIAowMDAwMDAwMzU5IDAwMDAwIG4gCjAwMDAwMDA0MTYgMDAwMDAgbiAKdHJhaWxlcgo8PC9TaXplIDgvUm9vdCA3IDAgUi9JbmZvIDEgMCBSPj4Kc3RhcnR4cmVmCjUyMQolJUVPRgo=";

test("renderPdfToImages: correctly renders a PDF to an array of images", async (t) => {
  const buffer = Buffer.from(tinyPdfBase64, "base64");
  const pages = await renderPdfToImages(buffer);

  t.is(pages.length, 1);
  t.is(pages[0].pageNumber, 1);
  t.truthy(pages[0].imageBuffer.length > 0);
  t.true(pages[0].width > 0);
  t.true(pages[0].height > 0);
});
