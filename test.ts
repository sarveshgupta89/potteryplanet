import { pipeline } from '@huggingface/transformers';

async function test() {
  try {
    console.log('Loading model...');
    const classifier = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32');
    console.log('Model loaded. Classifying...');
    const result = await classifier('https://picsum.photos/seed/2094/400/400', ['planter', 'urn', 'garden ball', 'fountain']);
    console.log(result);
  } catch (err) {
    console.error(err);
  }
}

test();
