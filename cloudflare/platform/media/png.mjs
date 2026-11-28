import {inflateSync,deflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {fail} from '../auth/http.mjs';
export const MAX_BYTES=5242880,MAX_PIXELS=4000000,MAX_EDGE=4096;
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
const table=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
export function pngChunk(type,data){const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(type,4,4,'ascii');data.copy(b,8);b.writeUInt32BE(crc32(b.subarray(4,-4)),b.length-4);return b;}
// Fully inflate and validate PNG scanlines, then strip all ancillary metadata.
// Browser upload controls convert supported raster inputs to this bounded format.
export function validatePNG(input){
 const b=Buffer.from(input);if(!b.length||b.length>MAX_BYTES)fail(413,'Images must be at most 5 MiB.');
 if(!b.subarray(0,8).equals(signature))fail(415,'Upload a PNG, or use the image picker to convert JPEG, WebP or AVIF. SVG and HTML are not supported.');
 let pos=8,header=null,width=0,height=0,channels=0,idat=[],ended=false,dataEnded=false;
 while(pos<b.length){
  if(pos+12>b.length)fail(400,'Truncated PNG.');const len=b.readUInt32BE(pos),end=pos+12+len;
  if(end>b.length)fail(400,'Truncated PNG chunk.');
  const type=b.toString('ascii',pos+4,pos+8),data=b.subarray(pos+8,end-4);
  if(!/^[A-Za-z]{4}$/.test(type)||crc32(b.subarray(pos+4,end-4))!==b.readUInt32BE(end-4))fail(400,'Invalid PNG checksum.');
  if(!header&&type!=='IHDR')fail(400,'PNG header must be first.');
  if(type==='IHDR'){
   if(header||pos!==8||len!==13)fail(400,'Invalid PNG header.');header=Buffer.from(data);width=data.readUInt32BE(0);height=data.readUInt32BE(4);
   channels=({0:1,2:3,4:2,6:4})[data[9]];
   if(!width||!height||width>MAX_EDGE||height>MAX_EDGE||width*height>MAX_PIXELS)fail(400,'Use an image up to 4096 pixels per side and 4 million pixels.');
   if(data[8]!==8||!channels||data[10]||data[11]||data[12])fail(415,'Use the image picker to convert this PNG to standard RGB or RGBA.');
  }else if(type==='IDAT'){if(dataEnded)fail(400,'Invalid PNG data order.');idat.push(data);}
  else if(type==='IEND'){if(len||!idat.length||end!==b.length)fail(400,'Invalid PNG end.');ended=true;}
  else{if(idat.length)dataEnded=true;if(['acTL','fcTL','fdAT','tRNS'].includes(type)||type[0]===type[0].toUpperCase())fail(415,'Use the image picker to convert animated or unsupported PNG.');}
  pos=end;if(ended)break;
 }
 if(!ended)fail(400,'Missing PNG end.');
 const stride=width*channels,expected=(stride+1)*height;let raw;
 try{const result=inflateSync(Buffer.concat(idat),{maxOutputLength:expected,info:true});raw=result.buffer;if(result.engine.bytesWritten!==idat.reduce((n,x)=>n+x.length,0)||raw.length!==expected)fail(400,'Invalid PNG data.');}catch(error){if(error.status)throw error;fail(400,'Invalid PNG compressed pixels.');}
 for(let y=0;y<height;y++)if(raw[y*(stride+1)]>4)fail(400,'Invalid PNG scanline filter.');
 const bytes=Buffer.concat([signature,pngChunk('IHDR',header),pngChunk('IDAT',deflateSync(raw)),pngChunk('IEND',Buffer.alloc(0))]);
 if(bytes.length>MAX_BYTES)fail(413,'Converted image exceeds 5 MiB.');
 return {bytes,width,height,mime_type:'image/png',size_bytes:bytes.length,checksum_sha256:createHash('sha256').update(bytes).digest('hex')};
}
