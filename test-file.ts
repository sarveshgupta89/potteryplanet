import fs from 'fs';

async function test() {
  const res = await fetch('https://picsum.photos/seed/2094/400/400');
  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync('dummy.jpg', Buffer.from(arrayBuffer));
  console.log('dummy.jpg created');
}

test();
