// Run: node tests/camera-reveal.browser.cjs <playwright module path> <cdp|webkit> <artifact directory>
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pw = require(process.argv[2]);
const engine = process.argv[3] || 'cdp';
const output = path.resolve(process.argv[4] || 'camera-browser-results');
const baseURL = process.env.CAMERA_TEST_URL || 'http://127.0.0.1:5174';
fs.mkdirSync(output, {recursive:true});
async function prepareCamera(page, mobile) {
  assert.equal(await page.getByRole('button',{name:'OFF',exact:true}).getAttribute('aria-pressed'),'true','New cameras must start with the timer off');
  assert.equal(await page.locator('.film-stripes, .camera-signature').count(),0,'The spectrum flag is gone');
  assert.equal(await page.locator('.camera-chin').innerText(),'','The print outlet carries no model line');
  assert.equal(await page.locator('.shutter svg').count(),0,'The shutter has no camera icon');
  assert.equal(await page.locator('.camera-tagline').count(),0);
  assert.equal(await page.getByText('Made to keep.').count(),0);
  assert(await page.locator('.camera-chin .ejection-slot').evaluate(e=>e.getBoundingClientRect().height>=12));
  await page.waitForFunction(()=>{const shutter=document.querySelector('[aria-label="Capture"]');return shutter&&!shutter.disabled;});
  assert.equal(await page.locator('.camera-settings legend').count(),0,'Settings have no captions, visible or hidden');
  if(mobile)for(const name of ['Upload photos','Mute sound effects','Enable sound effects'])assert.equal(await page.getByRole('button',{name,exact:true}).count(),0,`${name} is desktop only`);
}
(async()=>{
  const launched = engine === 'cdp'
    ? await pw.chromium.launch({channel:'chrome',headless:true,args:['--remote-debugging-port=9334','--disable-background-timer-throttling','--disable-renderer-backgrounding']})
    : await pw.webkit.launch({headless:true,executablePath:process.env.WEBKIT_EXECUTABLE_PATH});
  let browser = launched;
  try {
    if(engine === 'cdp')browser=await pw.chromium.connectOverCDP('http://127.0.0.1:9334');
    for (const width of (process.argv[5]==='small'?[568]:process.argv[5]==='extra'?[390]:process.argv[5]==='landscape'?[844,568]:[1280,390,360,393,320,844,568])) {
      const mobile=width!==1280;
      const context = await browser.newContext({viewport:{width,height:width===360?640:width===393?690:width===320?568:width===390?844:width===844?390:width===568?320:900},hasTouch:mobile,reducedMotion:'no-preference'});
      await context.addInitScript((engine)=>{
        if(!navigator.mediaDevices)Object.defineProperty(navigator,'mediaDevices',{value:{}});
        window.cameraRequests=0;window.cameraStops=0;
        window.frameCaptured=false;window.torchActive=false;window.torchEvents=[];
        new MutationObserver(()=>{
          if(!window.printAt&&document.querySelector('.instant-print'))window.printAt=performance.now();
          const flash=document.querySelector('.capture-flash');
          if(flash&&!window.flashAfterCapture){
            window.flashAfterCapture={opacity:Number(getComputedStyle(flash).opacity),color:getComputedStyle(flash).backgroundColor,width:flash.getBoundingClientRect().width,height:flash.getBoundingClientRect().height,afterFrame:window.frameCaptured};
          }
        }).observe(document,{childList:true,subtree:true});
        const captureDraw=CanvasRenderingContext2D.prototype.drawImage;
        CanvasRenderingContext2D.prototype.drawImage=function(source,...args){
          if(source instanceof HTMLVideoElement&&this.canvas.width===480){
            window.frameCaptured=true;window.torchEvents.push({event:'capture',lit:window.torchActive});
            const flash=document.querySelector('.capture-flash');
            window.flashAtCapture=flash?{opacity:Number(getComputedStyle(flash).opacity),color:getComputedStyle(flash).backgroundColor,width:flash.getBoundingClientRect().width,height:flash.getBoundingClientRect().height}:null;
          }
          return captureDraw.call(this,source,...args);
        };
        window.audioStarts=[];
        if(window.AudioBufferSourceNode){const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(when=0,...args){window.audioStarts.push({duration:this.buffer?.duration,when,now:this.context.currentTime});return start.call(this,when,...args);};}
        Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async(options)=>{
          window.cameraRequests++;
          const facing=options.video.facingMode.ideal;
          const lightControls=track=>{
            track.getConstraints=()=>({facingMode:{ideal:facing}});
            track.getCapabilities=()=>({torch:facing==='environment'&&!window.disableTorch});
            track.getSettings=()=>({facingMode:facing,torch:window.torchActive});
            track.applyConstraints=async constraints=>{
              if(constraints.facingMode)throw new DOMException('Mixed constraints','OverconstrainedError');
              window.torchActive=constraints.advanced[0].torch;window.torchEvents.push({event:window.torchActive?'on':'off'});
            };
            return track;
          };
          const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
          const ctx=canvas.getContext('2d');
          const photo=new Image();photo.src='/sample-flash.webp';await photo.decode();
          const paint=()=>ctx.drawImage(photo,0,0,640,480);
          paint();
          if(engine==='webkit'){
            Object.defineProperty(HTMLVideoElement.prototype,'requestVideoFrameCallback',{configurable:true,value:undefined});
            // Windows WebKit has no camera API; replace only the media boundary.
            const draw=CanvasRenderingContext2D.prototype.drawImage;
            CanvasRenderingContext2D.prototype.drawImage=function(source,...args){
              if(source instanceof HTMLVideoElement&&this.canvas.width===480){window.frameCaptured=true;window.torchEvents.push({event:'capture',lit:window.torchActive});const flash=document.querySelector('.capture-flash');window.flashAtCapture=flash?{opacity:Number(getComputedStyle(flash).opacity),color:getComputedStyle(flash).backgroundColor,width:flash.getBoundingClientRect().width,height:flash.getBoundingClientRect().height}:null;}
              return draw.call(this,source instanceof HTMLVideoElement?canvas:source,...args);
            };
            Object.defineProperties(HTMLVideoElement.prototype,{videoWidth:{configurable:true,get:()=>640},videoHeight:{configurable:true,get:()=>480},readyState:{configurable:true,get:()=>4},paused:{configurable:true,get:()=>false},srcObject:{configurable:true,writable:true,value:null}});
            HTMLVideoElement.prototype.play=async()=>{};
            const track=lightControls({stop(){window.cameraStops++;window.torchActive=false;},readyState:'live'});
            return {getTracks:()=>[track],getVideoTracks:()=>[track]};
          }
          const stream=canvas.captureStream(15);const timer=setInterval(paint,60);
          const track=lightControls(stream.getTracks()[0]),stop=track.stop.bind(track);track.stop=()=>{window.cameraStops++;window.torchActive=false;clearInterval(timer);stop();};return stream;
        }});
      },engine);
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(baseURL+'/');
      // Every size gets the same camera screen, with no separate desktop landing page.
      await page.locator('main.mobile-camera').waitFor();
      assert.equal(await page.locator('.camera-home, .camera-modal, .site-header').count(),0);
      await page.waitForFunction(()=>{const shutter=document.querySelector('[aria-label="Capture"]');return shutter&&!shutter.disabled;});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Live camera overflows horizontally');
      if(mobile&&process.argv[5]!=='inspect')assert(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),'Live camera exceeds the viewport height');
      await page.screenshot({path:path.join(output,`${engine}-${width}-home.png`),fullPage:true});
      if(process.argv[5]==='inspect'){console.log(JSON.stringify({engine,width,layout:await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight}))}));await context.close();continue;}
      await prepareCamera(page,mobile);
      if(!mobile)await page.screenshot({path:path.join(output,`${engine}-${width}-camera.png`)});
      assert(await page.locator('.camera-nameplate').evaluate(e=>{const box=e.getBoundingClientRect();return [...e.children].every(child=>{const r=child.getBoundingClientRect();return r.left>=box.left-1&&r.right<=box.right+1;});}),'Camera header must fit its navigation');
      if(mobile){
        assert.equal(await page.getByRole('link',{name:'Scrapbook',exact:true}).count(),0,'The camera has no scrapbook button');
        const iso=page.getByRole('slider');
        assert(await iso.evaluate(e=>e.getBoundingClientRect().height>=44),'ISO ruler must be a 44px target');
        // The bar has no printed numbers: a tap at each fifth of the travel reads 100, 400, 800 (centre), 1600, 3200.
        const travel=await iso.evaluate(e=>{const r=e.getBoundingClientRect(),pad=parseFloat(getComputedStyle(e.parentElement).getPropertyValue('--iso-pad'));return {pad,span:r.width-2*pad,y:r.height/2};});
        for(const [index,value] of [[0,100],[1,400],[2,800],[3,1600],[4,3200],[2,800]]){
          const x=travel.pad+travel.span*index/4;
          await iso.tap({position:{x,y:travel.y}});
          assert.equal(await iso.getAttribute('aria-valuenow'),String(value));
          await page.waitForTimeout(300); // a tap eases the needle over .25s
          const needle=await iso.locator('.iso-pointer').evaluate((e,left)=>{const r=e.getBoundingClientRect();return r.left+r.width/2-left;},(await iso.boundingBox()).x);
          assert(Math.abs(needle-x)<=1.5,`The needle sits on the ${value} stop`);
        }
        assert.equal(await iso.locator('.iso-mark').count(),0,'The ISO bar shows no numbers');
        // Dragging moves the needle with the finger; letting go snaps it to the nearest stop (70% along: 1600).
        const box=await iso.boundingBox(),needle=()=>iso.locator('.iso-pointer').evaluate(e=>{const r=e.getBoundingClientRect();return r.left+r.width/2;});
        const finger=box.x+travel.pad+travel.span*.7;
        await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
        await page.mouse.move(finger,box.y+box.height/2,{steps:6});
        // WebKit paints the drag state a frame later than Chromium, so wait for it rather than sampling once.
        await page.waitForFunction(()=>document.querySelector('.mobile-camera .iso-slider').classList.contains('sliding'),null,{timeout:2000});
        assert(Math.abs(await needle()-finger)<=2,'The ISO needle follows the pointer');
        await page.mouse.up();
        assert.equal(await iso.getAttribute('aria-valuenow'),'1600');
        await page.waitForTimeout(300);
        assert(Math.abs(await needle()-(box.x+travel.pad+travel.span*.75))<=1.5,'Letting go snaps the needle onto the 1600 stop');
        await iso.tap({position:{x:travel.pad+travel.span/2,y:travel.y}});
        const requests=await page.evaluate(()=>window.cameraRequests);
        await page.evaluate(()=>{window.cameraVideo=document.querySelector('video');});
        assert.equal(await page.getByRole('button',{name:'Camera settings',exact:true}).count(),0);
        await page.getByRole('button',{name:'B&W',exact:true}).click();
        await page.waitForTimeout(300);
        await page.screenshot({path:path.join(output,`${engine}-${width}-settings.png`)});
        await page.getByRole('slider').focus();
        await page.keyboard.press('ArrowRight');
        assert.equal(await page.getByRole('slider').getAttribute('aria-valuenow'),'1600');
        const size=page.viewportSize();await page.setViewportSize({width:size.height,height:size.width});
        assert.equal(await page.evaluate(()=>document.querySelector('video')===window.cameraVideo),true);
        assert.equal(await page.evaluate(()=>window.cameraRequests),requests);
        assert.equal(await page.getByRole('button',{name:'B&W',exact:true}).getAttribute('aria-pressed'),'true');
        assert.doesNotMatch(await page.locator('.viewfinder-readout').innerText(),/ISO|Film|B&W|1600/);
        await page.setViewportSize(size);
      }
      const cameraSurface=page.locator('.mobile-camera');
      assert.equal(await cameraSurface.locator('.viewfinder-readout').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
      await page.waitForTimeout(650);
      const pointerAt=()=>cameraSurface.locator('.iso-pointer').evaluate(e=>e.getBoundingClientRect().left);
      const initialPointer=await pointerAt();
      assert.equal(await cameraSurface.locator('.iso-pointer').evaluate(e=>getComputedStyle(e).transitionDuration),'0.25s');
      await cameraSurface.getByRole('slider').focus();
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(350);
      assert(await pointerAt()<initialPointer-10,'The ISO pointer must slide toward the sun');
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.getByRole('button',{name:'4-shot strip',exact:true}).count(),0);
      await cameraSurface.getByRole('switch',{name:'Flash effect',exact:true}).focus();
      await page.keyboard.press('Space');
      assert.equal(await cameraSurface.getByRole('switch',{name:'Flash effect',exact:true}).getAttribute('aria-checked'),'true');
      await page.evaluate(()=>{window.audioStarts=[];document.querySelector('[aria-label="Capture"]').addEventListener('click',()=>{window.captureAt=performance.now();},{once:true});});
      await page.getByRole('button',{name:'Capture',exact:true}).click();
      await page.locator('.instant-print').waitFor();
      assert.equal(await page.evaluate(()=>window.flashAtCapture),null,'Screen flash must start after capture');
      const flash=await page.evaluate(()=>window.flashAfterCapture);
      assert(flash&&flash.afterFrame&&flash.opacity>.30&&flash.opacity<=.35&&flash.color==='rgb(255, 246, 223)'&&flash.width===page.viewportSize().width&&flash.height===page.viewportSize().height,JSON.stringify(flash));
      await page.locator('.capture-flash').waitFor({state:'detached'});
      const sound=await page.evaluate(()=>({starts:window.audioStarts,printDelay:performance.now()-window.captureAt}));
      assert(sound.printDelay>=450,JSON.stringify(sound));
      if(sound.starts.length>=2){assert(Math.abs(sound.starts[0].duration-.672)<.01,JSON.stringify(sound));assert(Math.abs(sound.starts[1].when-sound.starts[0].now-.48)<.04,JSON.stringify(sound));}
      // The print stops moving as the ejection recording ends: the slide lasts the 2490ms clip.
      await page.waitForFunction(()=>Math.abs(new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.instant-print')).transform).m42)<.5,null,{polling:'raf'});
      const printStopped=await page.evaluate(()=>performance.now());
      sound.slide=printStopped-await page.evaluate(()=>window.printAt);
      assert(sound.slide>2300&&sound.slide<2800,JSON.stringify(sound));
      console.log(JSON.stringify({engine,width,sound}));
      await page.screenshot({path:path.join(output,`${engine}-${width}-ejecting.png`)});
      // The print develops on its own: no reveal button, gesture hint or shake text.
      assert.equal(await page.locator('.print-reveal button').count(),0,'Nothing to press while the print develops');
      assert.doesNotMatch(await page.locator('.print-reveal').innerText(),/shake|reveal/i);
      await page.waitForFunction(()=>Math.abs(new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.instant-print')).transform).m42)<.1);
      const outlet=await page.evaluate(()=>{const surface=document.querySelector('.mobile-camera')||document.querySelector('.camera-modal');const slot=surface.querySelector('.ejection-slot').getBoundingClientRect(),paper=surface.querySelector('.instant-paper').getBoundingClientRect();return {slot:{x:slot.x,width:slot.width,top:slot.top,bottom:slot.bottom},paper:{x:paper.x,width:paper.width,top:paper.top}};});
      assert(outlet.paper.x>=outlet.slot.x-1&&outlet.paper.x+outlet.paper.width<=outlet.slot.x+outlet.slot.width+1&&outlet.paper.top>=outlet.slot.top&&outlet.paper.top<outlet.slot.bottom-2,JSON.stringify(outlet));
      if(mobile)assert(await page.locator('.instant-paper').evaluate(e=>{const r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+2)?.closest('.instant-paper')===e;}),'Paper must be in front of the camera at the slot');
      await page.screenshot({path:path.join(output,`${engine}-${width}-blank.png`)});
      // Blank for 2.5s after the print stops, then an even 9s fade.
      await page.waitForTimeout(Math.max(0,2200-(await page.evaluate(()=>performance.now())-printStopped)));
      assert.equal(await page.locator('.instant-photo-window img').evaluate(e=>Number(getComputedStyle(e).opacity)),0,'photo must remain blank for 2.5 seconds after printing');
      assert.equal(await page.getByRole('button',{name:'4-shot strip',exact:true}).count(),0);
      const development=[];
      for(const sampleAt of [3800,7000]){
        await page.waitForTimeout(Math.max(0,sampleAt-(await page.evaluate(()=>performance.now())-printStopped)));
        const sample=await page.locator('.instant-photo-window img').evaluate(e=>({time:performance.now(),opacity:Number(getComputedStyle(e).opacity)}));
        const elapsed=sample.time-printStopped,expected=(elapsed-2500)/9000;
        assert(Math.abs(sample.opacity-expected)<.08,`development should fade evenly: ${JSON.stringify({elapsed,expected,...sample})}`);
        development.push({elapsed,opacity:sample.opacity});
      }
      await page.screenshot({path:path.join(output,`${engine}-${width}-developing.png`)});
      await page.getByRole('button',{name:'Save Photo',exact:true}).waitFor({timeout:15000});
      assert.equal(await page.locator('.instant-photo-window img').evaluate(e=>Number(getComputedStyle(e).opacity)),1);
      console.log(JSON.stringify({engine,width,development}));
      assert.equal(await page.locator('.instant-photo-window').count(),1);
      const layout=await page.evaluate(()=>{const surface=document.querySelector('main.mobile-camera')||document.querySelector('.camera-experience');return {viewport:innerWidth,page:document.documentElement.scrollWidth,dialog:surface.scrollWidth,dialogWidth:surface.clientWidth};});
      assert(layout.page<=layout.viewport&&layout.dialog<=layout.dialogWidth,JSON.stringify(layout));
      await page.screenshot({path:path.join(output,`${engine}-${width}-revealed.png`)});
      for(const label of ['Develop','Done','Retake photo','Photo revealed'])assert.equal(await page.getByRole('button',{name:label,exact:true}).count(),0,`${label} must not return`);
      const save=page.getByRole('button',{name:'Save Photo',exact:true});
      await save.scrollIntoViewIfNeeded();
      assert(await save.evaluate(e=>{const r=e.getBoundingClientRect();return r.height>=44&&r.bottom<=innerHeight;}),'Save Photo must be reachable');
      const downloadPromise=page.waitForEvent('download');await save.click();
      const download=await downloadPromise;assert.equal(await download.failure(),null);assert.match(download.suggestedFilename(),/^my-polaroid-\d{4}-\d{2}-\d{2}-\d{6}\.jpg$/);await download.saveAs(path.join(output,`${engine}-${width}.jpg`));
      // Saving resets to the live camera with the next shot already loaded.
      await page.locator('.instant-print').waitFor({state:'detached'});
      assert.equal(page.url(),baseURL+'/');
      await page.waitForFunction(()=>{const shutter=document.querySelector('[aria-label="Capture"]');return shutter&&!shutter.disabled;});
      await page.getByRole('button',{name:'Capture',exact:true}).click();
      await page.locator('.instant-print').waitFor();
      assert.equal(await page.locator('.instant-print').count(),1);
      assert.equal(await save.count(),0,'A new print develops before Save returns');
      // Roll again clears an unsaved print without leaving the camera.
      await page.getByRole('button',{name:'Load film',exact:true}).click();
      await page.locator('.instant-print').waitFor({state:'detached'});
      assert.deepEqual(errors,[]);
      if(width===390){
        await page.goto(baseURL+'/');await prepareCamera(page,true);
        await page.getByRole('button',{name:'Flip camera',exact:true}).click();
        await page.getByRole('switch',{name:'Flash effect',exact:true}).click();
        await page.getByRole('button',{name:'Capture',exact:true}).click();
        await page.locator('.instant-print').waitFor();
        assert.deepEqual(await page.evaluate(()=>window.torchEvents),[{event:'on'},{event:'capture',lit:true},{event:'off'}]);
        assert.equal(await page.evaluate(()=>window.flashAfterCapture),undefined,'Rear camera must not use a screen flash');
        await page.goto(baseURL+'/');await page.evaluate(()=>window.disableTorch=true);await prepareCamera(page,true);
        await page.getByRole('button',{name:'Flip camera',exact:true}).click();
        await page.getByRole('switch',{name:'Flash effect',exact:true}).click();
        await page.getByRole('button',{name:'Capture',exact:true}).click();
        await page.getByText('Rear-camera flash is unavailable. Turn Flash off to take a photo.',{exact:true}).waitFor();
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Flash notice overflows');
        await page.screenshot({path:path.join(output,`${engine}-rear-flash-unavailable.png`),fullPage:true});
        await page.getByRole('switch',{name:'Flash effect',exact:true}).click();
        await page.getByRole('button',{name:'Capture',exact:true}).click();await page.locator('.instant-print').waitFor();
        console.log(JSON.stringify({engine,rearLightSequence:true,unsupportedRearRecovery:true}));
        await page.emulateMedia({reducedMotion:'reduce'});await page.goto(baseURL+'/');
        await prepareCamera(page,true);await page.getByRole('switch',{name:'Flash effect',exact:true}).click();await page.getByRole('button',{name:'Capture',exact:true}).click();
        await page.locator('.instant-print').waitFor();
        assert.equal(await page.evaluate(()=>window.flashAtCapture?.opacity),1,'Reduced motion keeps a steady light before capture');
        assert.equal(await page.locator('.capture-flash').count(),0);
        await page.getByRole('button',{name:'Load film',exact:true}).focus();await page.keyboard.press('Enter');
        await page.waitForFunction(()=>{const shutter=document.querySelector('[aria-label="Capture"]');return shutter&&!shutter.disabled;});
        await page.getByRole('button',{name:'Capture',exact:true}).focus();await page.keyboard.press('Enter');
        await page.getByRole('button',{name:'Save Photo',exact:true}).waitFor();
        await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Save Photo',null,{timeout:2000}).catch(()=>{});
        assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Save Photo','Keyboard focus moves to Save Photo once it is ready');
        console.log(JSON.stringify({engine,reducedMotion:true,keyboardSaveFocus:true}));
      }
      assert.deepEqual(errors,[]);
      console.log(JSON.stringify({engine,width,layout,save:true,rollAgain:true,errors}));
      await context.close();
    }
    if(process.argv[5]==='inspect')return;
    for(const permission of ['pending','denied']){
      // Upload is desktop only, so the no-camera recovery runs at a desktop size.
      const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
      await context.addInitScript(permission=>{
        window.cameraRequests=0;window.cameraStops=0;window.pendingCameras=[];
        if(!navigator.mediaDevices)Object.defineProperty(navigator,'mediaDevices',{value:{}});
        Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:()=>{
          window.cameraRequests++;
          return permission==='denied'?Promise.reject(new DOMException('Denied','NotAllowedError')):new Promise(resolve=>window.pendingCameras.push(resolve));
        }});
      },permission);
      const page=await context.newPage();await page.goto(baseURL+'/');
      await page.getByText(permission==='pending'?'Waiting for the camera. Allow access if your browser asks.':/Camera permission was declined/).waitFor();
      assert(await page.getByRole('button',{name:'Capture',exact:true}).isDisabled());
      assert(await page.getByRole('button',{name:'Upload photos',exact:true}).isEnabled());
      if(permission==='denied'){
        const requests=await page.evaluate(()=>window.cameraRequests);
        await page.getByRole('button',{name:'Retry camera',exact:true}).click();
        await page.waitForFunction(expected=>window.cameraRequests===expected,requests+1);
      }
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
      await page.screenshot({path:path.join(output,`${engine}-${permission}.png`),fullPage:true});
      if(permission==='pending'){
        const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Upload photos',exact:true}).click();await (await chooser).setFiles(path.resolve('public/sample-coast.png'));
        await page.locator('.instant-print').waitFor();
        // A camera that answers after the upload printed must not stay on behind the print.
        await page.evaluate(()=>window.pendingCameras.forEach(resolve=>resolve({getTracks:()=>[{stop(){window.cameraStops++;}}]})));
        await page.waitForFunction(()=>window.cameraStops===window.cameraRequests);
      }else{
        const chooserPromise=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Upload photos',exact:true}).click();
        await (await chooserPromise).setFiles(path.resolve('public/sample-coast.png'));
        // Without a camera, an upload still prints, develops, and saves on the camera screen.
        await page.getByRole('button',{name:'Save Photo',exact:true}).waitFor();
        assert.equal(page.url(),baseURL+'/');
        await page.screenshot({path:path.join(output,`${engine}-${permission}-upload.png`),fullPage:true});
        const requests=await page.evaluate(()=>window.cameraRequests);
        await page.getByRole('button',{name:'Load film',exact:true}).click();
        await page.locator('.instant-print').waitFor({state:'detached'});
        await page.waitForFunction(expected=>window.cameraRequests===expected,requests+1);
        await page.getByText(/Camera permission was declined/).waitFor();
      }
      console.log(JSON.stringify({engine,permission,retry:permission==='denied',uploadAndSave:permission==='denied',lateStreamCleanup:permission==='pending',overflow}));
      await context.close();
    }
  } finally {await browser.close();if(browser!==launched)await launched.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
