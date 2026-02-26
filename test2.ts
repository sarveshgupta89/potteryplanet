import { pipeline } from '@huggingface/transformers';
import fs from 'fs';

async function test() {
  try {
    console.log('Loading model...');
    const classifier = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32');
    console.log('Model loaded. Classifying...');
    
    // Create a dummy image file
    fs.writeFileSync('dummy.jpg', 'fake image data');
    
    const result = await classifier('dummy.jpg', ['planter', 'urn', 'garden ball', 'fountain']);
    console.log(result);
  } catch (err) {
    console.error(err);
  }
}

test();
