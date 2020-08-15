/*
A basic version showing how to execute evented polyrhythm-style
code inside the new runtime DENO.

> deno run --allow-net=githubusercontent.com examples/deno-poly.ts
*/
import {
  channel,
  after,
} from 'https://s3.amazonaws.com/www.deanius.com/polyrhythm.1.0.0.development.js';
channel.listen('greet', () => console.log('World'));
channel.filter(true, () => console.log('Hello'));
channel.trigger('greet');
await after(1000, () => console.log('Goodbye!'));
