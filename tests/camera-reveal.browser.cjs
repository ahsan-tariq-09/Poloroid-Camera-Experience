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
  assert.equal(await page.getByRole('button',{name:'Timer off',exact:true}).getAttribute('aria-pressed'),'true','New cameras must start with the timer off');
  assert.equal(await page.locator('.film-stripes').count(),1);
  assert.deepEqual(await page.locator('.camera-signature .film-stripes i').evaluateAll(elements=>elements.map(e=>getComputedStyle(e).backgroundColor)),['rgb(0, 118, 163)','rgb(255, 191, 54)','rgb(255, 30, 39)']);
  assert(await page.locator('.camera-tagline').isVisible());
  assert(await page.locator('.ejection-slot').evaluate(e=>e.getBoundingClientRect().height>=28));
  if(!mobile)await page.getByRole('button',{name:'Roll film',exact:true}).click();
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
        const addListener=window.addEventListener.bind(window),removeListener=window.removeEventListener.bind(window);
        window.addEventListener=(type,...args)=>{if(type==='devicemotion')window.motionListenerReady=true;return addListener(type,...args);};
        window.removeEventListener=(type,...args)=>{if(type==='devicemotion')window.motionListenerReady=false;return removeListener(type,...args);};
        if(!navigator.mediaDevices)Object.defineProperty(navigator,'mediaDevices',{value:{}});
        window.cameraRequests=0;window.cameraStops=0;
        window.frameCaptured=false;window.torchActive=false;window.torchEvents=[];
        new MutationObserver(()=>{
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
      if(mobile)await page.waitForURL('**/camera');
      if(mobile)await page.waitForFunction(()=>{const shutter=document.querySelector('[aria-label="Capture"]');return shutter&&!shutter.disabled;});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Live camera overflows horizontally');
      if(mobile&&process.argv[5]!=='inspect')assert(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),'Live camera exceeds the viewport height');
      await page.screenshot({path:path.join(output,`${engine}-${width}-home.png`),fullPage:true});
      if(process.argv[5]==='inspect'){console.log(JSON.stringify({engine,width,layout:await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight}))}));await context.close();continue;}
      await prepareCamera(page,mobile);
      if(!mobile){
        await page.waitForFunction(()=>{const shutter=document.querySelector('[aria-label="Capture"]');return shutter&&!shutter.disabled;});
        await page.screenshot({path:path.join(output,`${engine}-${width}-camera.png`)});
      }
      if(mobile){
        assert.equal(await page.getByRole('link',{name:'Scrapbook',exact:true}).count(),0);
        assert(await page.locator('.iso-dial .dial-hub').isVisible(),'ISO metal center must stay visible on short screens');
        assert.equal(await page.getByRole('slider',{name:'ISO effect',exact:true}).innerText(),'');
        for(const value of [100,200,400,800,1600,3200,800]){
          const stop=page.getByRole('button',{name:`ISO ${value}`,exact:true});
          assert(await stop.isVisible(),`ISO ${value} must stay on the ring`);
          await stop.tap();
          assert.equal(await stop.getAttribute('aria-pressed'),'true');
          assert.equal(await page.getByRole('slider',{name:'ISO effect',exact:true}).getAttribute('aria-valuenow'),String(value));
        }
        const requests=await page.evaluate(()=>window.cameraRequests);
        await page.evaluate(()=>{window.cameraVideo=document.querySelector('video');});
        assert.equal(await page.getByRole('button',{name:'Camera settings',exact:true}).count(),0);
        await page.getByRole('button',{name:'B&W',exact:true}).click();
        await page.waitForTimeout(300);
        await page.screenshot({path:path.join(output,`${engine}-${width}-settings.png`)});
        await page.getByRole('slider',{name:'ISO effect',exact:true}).focus();
        await page.keyboard.press('ArrowRight');
        assert.equal(await page.getByRole('slider',{name:'ISO effect',exact:true}).getAttribute('aria-valuenow'),'1600');
        const size=page.viewportSize();await page.setViewportSize({width:size.height,height:size.width});
        assert.equal(await page.evaluate(()=>document.querySelector('video')===window.cameraVideo),true);
        assert.equal(await page.evaluate(()=>window.cameraRequests),requests);
        assert.match(await page.locator('.viewfinder-readout').innerText(),/B&W/);
        await page.setViewportSize(size);
      }
      const cameraSurface=page.locator(mobile?'.mobile-camera':'.camera-modal');
      assert.equal(await cameraSurface.locator('.viewfinder-readout').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
      await page.waitForTimeout(650);
      const initialWheel=await cameraSurface.locator('.iso-markings').evaluate(e=>getComputedStyle(e).transform);
      await cameraSurface.getByRole('slider',{name:'ISO effect',exact:true}).focus();
      await page.keyboard.press('ArrowLeft');
      const dialFrames=await cameraSurface.evaluate(async surface=>{
        const frames=[];
        for(let i=0;i<12;i++){
          await new Promise(resolve=>requestAnimationFrame(resolve));
          const wheel=getComputedStyle(surface.querySelector('.iso-markings')).transform;
          const hub=surface.querySelector('.iso-dial .dial-hub');
          const matrix=new DOMMatrixReadOnly(wheel);
          frames.push({wheel,hubWidth:hub.getBoundingClientRect().width,rotatedWidth:hub.offsetWidth*(Math.abs(matrix.a)+Math.abs(matrix.b))});
        }
        return frames;
      });
      assert(dialFrames.every(({hubWidth,rotatedWidth})=>Math.abs(hubWidth-rotatedWidth)<.1),'ISO center must rotate with its wheel');
      assert(dialFrames.some(({wheel})=>wheel!==initialWheel),'ISO must turn between settings');
      assert.equal(await cameraSurface.locator('.iso-markings').evaluate(e=>getComputedStyle(e).transitionDuration),'0.6s');
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
      console.log(JSON.stringify({engine,width,sound}));
      await page.screenshot({path:path.join(output,`${engine}-${width}-ejecting.png`)});
      const reveal=page.getByRole('button',{name:'Shake to reveal',exact:true});
      await page.waitForFunction(()=>{const button=document.querySelector('.shake-reveal');return button&&!button.disabled;});
      await page.waitForFunction(()=>Math.abs(new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.instant-print')).transform).m42)<.1);
      const outlet=await page.evaluate(()=>{const surface=document.querySelector('.mobile-camera')||document.querySelector('.camera-modal');const slot=surface.querySelector('.ejection-slot').getBoundingClientRect(),paper=surface.querySelector('.instant-paper').getBoundingClientRect();return {slot:{x:slot.x,width:slot.width,top:slot.top,bottom:slot.bottom},paper:{x:paper.x,width:paper.width,top:paper.top}};});
      assert(Math.abs(outlet.slot.x-outlet.paper.x)<3&&Math.abs(outlet.slot.width-outlet.paper.width)<3&&outlet.paper.top>outlet.slot.top&&outlet.paper.top<outlet.slot.bottom-6,JSON.stringify(outlet));
      if(mobile)assert(await page.locator('.instant-paper').evaluate(e=>{const r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+2)?.closest('.instant-paper')===e;}),'Paper must be in front of the camera at the slot');
      await page.screenshot({path:path.join(output,`${engine}-${width}-blank.png`)});
      await reveal.scrollIntoViewIfNeeded();
      await page.evaluate(()=>{
        window.shakeSamples=[];window.shakeSampling=setInterval(()=>window.shakeSamples.push(getComputedStyle(document.querySelector('.print-drag')).transform),16);
      });
      await reveal.click();
      const developmentStarted=await page.evaluate(()=>performance.now());
      await page.waitForTimeout(850);
      assert.equal(await page.locator('.instant-photo-window img').evaluate(e=>Number(getComputedStyle(e).opacity)),0,'photo must remain blank for the first two seconds');
      const transforms=await page.evaluate(()=>{clearInterval(window.shakeSampling);return [...new Set(window.shakeSamples)];});
      assert(transforms.some(t=>t!=='none'&&t!=='matrix(1, 0, 0, 1, 0, 0)'),`button did not shake: ${transforms}`);
      assert.equal(await page.getByRole('button',{name:'4-shot strip',exact:true}).count(),0);
      const development=[];
      for(const sampleAt of [3300,6500]){
        await page.waitForTimeout(Math.max(0,sampleAt-(await page.evaluate(()=>performance.now())-developmentStarted)));
        const sample=await page.locator('.instant-photo-window img').evaluate(e=>({time:performance.now(),opacity:Number(getComputedStyle(e).opacity)}));
        const elapsed=sample.time-developmentStarted,expected=(elapsed-2000)/9000;
        assert(Math.abs(sample.opacity-expected)<.08,`development should fade evenly: ${JSON.stringify({elapsed,expected,...sample})}`);
        development.push({elapsed,opacity:sample.opacity});
      }
      await page.screenshot({path:path.join(output,`${engine}-${width}-developing.png`)});
      await page.getByRole('button',{name:'Photo revealed',exact:true}).waitFor({timeout:15000});
      assert.equal(await page.locator('.instant-photo-window img').evaluate(e=>Number(getComputedStyle(e).opacity)),1);
      console.log(JSON.stringify({engine,width,development}));
      assert.equal(await page.locator('.instant-photo-window').count(),1);
      assert.equal(await page.locator('.print-drag').evaluate(e=>getComputedStyle(e).transform),'none');
      const layout=await page.evaluate(()=>{const surface=document.querySelector('main.mobile-camera')||document.querySelector('.camera-experience');return {viewport:innerWidth,page:document.documentElement.scrollWidth,dialog:surface.scrollWidth,dialogWidth:surface.clientWidth};});
      assert(layout.page<=layout.viewport&&layout.dialog<=layout.dialogWidth,JSON.stringify(layout));
      await page.screenshot({path:path.join(output,`${engine}-${width}-revealed.png`)});
      if(mobile)assert(await page.evaluate(()=>{const button=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Done');return button.getBoundingClientRect().bottom<=innerHeight;}),'Finish actions exceed the viewport');
      const contrast=await page.getByRole('button',{name:'Done',exact:true}).evaluate(e=>({color:getComputedStyle(e).color,background:getComputedStyle(e).backgroundColor}));
      if(mobile)assert.deepEqual(contrast,{color:'rgb(41, 44, 38)',background:'rgb(250, 246, 236)'});
      await page.getByRole('button',{name:'Done',exact:true}).click();await page.waitForURL('**/finish');
      const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Save Photo',exact:true}).click();
      const download=await downloadPromise;assert.equal(await download.failure(),null);await download.saveAs(path.join(output,`${engine}-${width}.jpg`));
      await page.getByRole('link',{name:'Back to editing'}).click();await page.waitForURL('**/edit');
      await page.getByRole('heading',{name:'Edit your Polaroid',exact:true}).waitFor();
      assert.equal(await page.getByText('Arrange photos, add pieces, or adjust the look.',{exact:true}).count(),0);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Editor overflows horizontally');
      assert(await page.getByRole('button',{name:'Continue',exact:true}).isVisible());
      await page.waitForFunction(()=>Math.abs(new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.artboard')).transform).m42)<.1);
      const labelSize=await page.locator('.target-label').evaluate(e=>{const matrix=e.getScreenCTM();return parseFloat(getComputedStyle(e).fontSize)*Math.hypot(matrix.a,matrix.b);});
      assert(Math.abs(labelSize-14)<.1,`Selected filename must remain readable at every viewport: ${labelSize}px`);
      assert(await page.locator('.target-label').evaluate(e=>e.getBoundingClientRect().top>=document.querySelector('.canvas-toolbar').getBoundingClientRect().bottom),'Selected filename must clear the toolbar');
      await page.screenshot({path:path.join(output,`${engine}-${width}-edit.png`),fullPage:true});
      await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForURL('**/finish');
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
        for(const method of ['pointer','sensor']){
          await page.goto(baseURL+'/');
          await page.evaluate(()=>{if(!window.DeviceMotionEvent)window.DeviceMotionEvent=Event;});
          await prepareCamera(page,true);
          await page.getByRole('button',{name:'Capture',exact:true}).click();
          await page.waitForFunction(()=>{const button=document.querySelector('.shake-reveal');return button&&!button.disabled;});
          if(method==='pointer'){
            const box=await page.locator('.print-drag').boundingBox();
            const x=box.x+box.width/2,y=box.y+box.height/2;
            await page.mouse.move(x,y);await page.mouse.down();
            for(const delta of [55,-55,55])await page.mouse.move(x+delta,y,{steps:5});
            await page.mouse.up();
          }else{
            await page.waitForFunction(()=>window.motionListenerReady&&!document.hidden);
            await page.evaluate(()=>{
              for(let i=0;i<5;i++){
                const event=new Event('devicemotion');
                Object.defineProperties(event,{acceleration:{value:{x:i%2?-25:25,y:0,z:0}},timeStamp:{value:100+i*220}});
                window.dispatchEvent(event);
              }
            });
          }
          await page.locator('.instant-photo-window img').waitFor();
          const rotations=await page.evaluate(async()=>{
            const samples=[];
            for(let i=0;i<45;i++){
              await new Promise(resolve=>requestAnimationFrame(resolve));
              const m=new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.print-drag')).transform);
              samples.push(Math.atan2(m.b,m.a));
            }
            return samples;
          });
          assert(rotations.every(angle=>Math.abs(angle)<0.001),`${method} added a shake`);
          await page.evaluate(()=>{
            Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
            document.dispatchEvent(new Event('visibilitychange'));
          });
          await page.getByRole('button',{name:'Photo revealed',exact:true}).waitFor();
          assert.equal(await page.locator('.print-drag').evaluate(e=>getComputedStyle(e).transform),'none');
          await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
          console.log(JSON.stringify({engine,method,noExtraShake:true,hiddenPageSettles:true}));
        }
        await page.emulateMedia({reducedMotion:'reduce'});await page.goto(baseURL+'/');
        await prepareCamera(page,true);await page.getByRole('switch',{name:'Flash effect',exact:true}).click();await page.getByRole('button',{name:'Capture',exact:true}).click();
        await page.locator('.instant-print').waitFor();
        assert.equal(await page.evaluate(()=>window.flashAtCapture?.opacity),1,'Reduced motion keeps a steady light before capture');
        assert.equal(await page.locator('.capture-flash').count(),0);
        await page.getByRole('button',{name:'Retake photo',exact:true}).click();
        await page.getByRole('button',{name:'Capture',exact:true}).click();
        await page.getByRole('button',{name:'Shake to reveal',exact:true}).focus();await page.keyboard.press('Enter');
        await page.getByRole('button',{name:'Photo revealed',exact:true}).waitFor();
        assert.equal(await page.locator('.print-drag').evaluate(e=>getComputedStyle(e).transform),'none');
        await page.getByRole('button',{name:'Develop',exact:true}).click();await page.waitForURL('**/edit');
        console.log(JSON.stringify({engine,reducedMotion:true,keyboardReveal:true,develop:true}));
      }
      assert.deepEqual(errors,[]);
      if(mobile){
        await page.getByRole('button',{name:/^(1 )?Start$/}).click();await page.waitForURL('**/camera');
        await page.getByRole('link',{name:'Continue your Polaroid',exact:true}).waitFor();
        assert(await page.locator('.camera-nameplate').evaluate(e=>{const box=e.getBoundingClientRect();return [...e.children].every(child=>{const r=child.getBoundingClientRect();return r.left>=box.left-1&&r.right<=box.right+1;});}),'Camera header must fit with the resume link');
        await page.screenshot({path:path.join(output,`${engine}-${width}-resume.png`)});
      }
      console.log(JSON.stringify({engine,width,shakeSamples:transforms.length,layout,finish:true,edit:true,errors}));
      await context.close();
    }
    if(process.argv[5]==='inspect')return;
    for(const permission of ['pending','denied']){
      const context=await browser.newContext({viewport:{width:320,height:568},hasTouch:true,reducedMotion:'reduce'});
      await context.addInitScript(permission=>{
        window.cameraRequests=0;window.cameraStops=0;window.pendingCameras=[];
        if(!navigator.mediaDevices)Object.defineProperty(navigator,'mediaDevices',{value:{}});
        Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:()=>{
          window.cameraRequests++;
          return permission==='denied'?Promise.reject(new DOMException('Denied','NotAllowedError')):new Promise(resolve=>window.pendingCameras.push(resolve));
        }});
      },permission);
      const page=await context.newPage();await page.goto(baseURL+'/');await page.waitForURL('**/camera');
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
        const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Upload photos',exact:true}).click();await (await chooser).setFiles(path.resolve('public/sample-coast.png'));await page.waitForURL('**/edit');
        await page.locator('.mobile-camera').waitFor({state:'detached'});
        await page.evaluate(()=>window.pendingCameras.forEach(resolve=>resolve({getTracks:()=>[{stop(){window.cameraStops++;}}]})));
        await page.waitForFunction(()=>window.cameraStops===window.cameraRequests);
      }else{
        const chooserPromise=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Upload photos',exact:true}).click();
        await (await chooserPromise).setFiles(path.resolve('public/sample-coast.png'));
        await page.waitForURL('**/edit');
        await page.getByRole('button',{name:/^(1 )?Start$/}).click();await page.waitForURL('**/camera');
        await page.locator('input[type="file"]').setInputFiles(path.resolve('public/sample-coast.png'));
        await page.getByRole('dialog',{name:'Start a new Polaroid?'}).waitFor();
        assert.equal(await page.getByRole('dialog').evaluate(e=>getComputedStyle(e).color),'rgb(41, 44, 38)');
        await page.getByRole('button',{name:'Keep editing',exact:true}).click();
        await page.getByRole('link',{name:'Continue your Polaroid',exact:true}).click();await page.waitForURL('**/edit');
      }
      console.log(JSON.stringify({engine,permission,retry:permission==='denied',uploadAndResume:permission==='denied',lateStreamCleanup:permission==='pending',overflow}));
      await context.close();
    }
  } finally {await browser.close();if(browser!==launched)await launched.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
