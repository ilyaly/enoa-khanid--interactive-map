//Basics
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
//Post-processing
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
//import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';

//Loaders
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
//Renderers
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
//Animation
import { gsap } from 'https://cdn.skypack.dev/gsap@3.9.0';

//Basics
let scene, camera, renderer, labelRenderer, controls;


let composer, effectFXAA, outlinePass;
let objectsToOutline = [];
let mouseOverObject;
let selectedObject;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();


const siteIds = [];
const audioIds = [];

let cloudsTexture;

let flight;

let sun;

const audioContext = new(window.AudioContext || window.webkitAudioContext)();

let isSceneStartedByUser = false;
let isSceneLoaded = false;

document.addEventListener("onmousedown", (event) => {
    if (flight) {
        flight.kill();
    }

})

document.addEventListener("wheel", (event) => {
    if (flight) {
        flight.kill();
    }

})


init();
animate();
render();

const playButton = document.getElementById('playButton')
playButton.addEventListener('click', function() {
    isSceneStartedByUser = true;
    playButton.style.opacity = "0%";
    if (isSceneLoaded) {
        setTimeout(() => {
            const overlay = document.getElementById('overlay');
            overlay.style.display = 'none';
            audioContext.resume();
        }, "3000");

    }
});

const dayNightSwitch = document.getElementById('day-night-switch');
dayNightSwitch.addEventListener('click', function() {
    if (sun) {
        if (dayNightSwitch.innerHTML === "☾") {
            dayNightSwitch.innerHTML = "☉";
        } else {
            dayNightSwitch.innerHTML = "☾";
        }

        gsap.to(sun.rotation, {
            duration: 7,
            x: 0,
            y: 0,
            z: sun.rotation.z + Math.PI,
            delay: 0.5,
            ease: "power3.inOut",
        });
    }


});


function init() {
    //Basics
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.antialias = true;
    //renderer.setClearColor(0x000000); // Set white background color
    document.body.appendChild(renderer.domElement);



    //Cameras
    camera.position.set(0, 2300, 0)
    camera.rotation.set(0, -0.45, 0)

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
    //controls.enableRotate = false;
    //controls.minAzimuthAngle = -Math.PI * 0.16;
    //controls.maxAzimuthAngle = Math.PI * 0.16;
    controls.zoomSpeed = 0.5;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.maxPolarAngle = Math.PI / 6;
    controls.maxDistance = 2300;
    controls.minDistance = 700;
    controls.autoRotateSpeed = 0.5;


    const minPan = new THREE.Vector3(-1000, -2300, -1500);
    const maxPan = new THREE.Vector3(1000, 2300, 1500);
    let _v = new THREE.Vector3();


    controls.addEventListener("change", function() {
        _v.copy(controls.target);
        controls.target.clamp(minPan, maxPan);
        _v.sub(controls.target);
        camera.position.sub(_v);
    })

    //Label 
    labelRenderer = new CSS3DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.id = 'label-renderer';
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    labelRenderer.domElement.style.pointerEvents = 'none';
    labelRenderer.domElement.style.zIndex = '1'
    document.body.appendChild(labelRenderer.domElement);

    // Light
    scene.add(new THREE.AmbientLight(0x5c9fbc, 1));
    //const hL = scene.add(new THREE.HemisphereLight(0xffffbb, 0x080820, 1));
    //hL.position.set(0, 0, 0)
    const d = 100;
   
    sun = new THREE.Group();

    let light_2 = new THREE.DirectionalLight(0xFCE570, 1);
    /*
    light_2.position.set(0, 1000, 0);
    light_2.castShadow = true;
    light_2.shadow.mapSize.width = 1024;
    light_2.shadow.mapSize.height = 1024;


    light_2.shadow.camera.left = -d;
    light_2.shadow.camera.right = d;
    light_2.shadow.camera.top = d;
    light_2.shadow.camera.bottom = -d;
    light_2.shadow.camera.far = 2000;
    */
    sun.add(light_2);
    sun.rotation.z + Math.PI / 4
    scene.add(sun);

    //Fog
    scene.fog = new THREE.FogExp2(0x000000, 0.00015);
    //scene.fog = new THREE.Fog(0xcccccc, 2000, 2600);

    //Audio

    const audioListener = new THREE.AudioListener();
    camera.add(audioListener);


    //Clouds
    cloudsTexture = new THREE.TextureLoader().load('https://ilyaly.github.io/enoa-khanid-interactive-map/public/images/fx_cloudalpha05.png');
    cloudsTexture.wrapS = THREE.RepeatWrapping;
    cloudsTexture.wrapT = THREE.RepeatWrapping;
    const planeGeometry = new THREE.PlaneGeometry(10000, 10000, 10, 10);
    const planeMaterial = new THREE.MeshPhysicalMaterial({ map: cloudsTexture, side: THREE.DoubleSide, transparent: true });
    const cloudsPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    cloudsPlane.position.set(0, 1000, 0);
    cloudsPlane.rotation.x = -1.57079633;
    scene.add(cloudsPlane);

    // postprocessing

    composer = new EffectComposer(renderer);

    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);
    outlinePass.edgeStrength = 3;
    outlinePass.edgeGlow = 0.5;
    outlinePass.edgeThickness = 1;
    composer.addPass(outlinePass);


    /*
    const bokehPass = new BokehPass(scene, camera, {
        focus: 130,
        aperture: 3.1,
        maxblur: 0.005
    });
    composer.addPass( bokehPass );
    */

    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    effectFXAA = new ShaderPass(FXAAShader);
    effectFXAA.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);
    composer.addPass(effectFXAA);

    window.addEventListener('resize', onWindowResize);

    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('click', onMouseClick);

    function onPointerMove(event) {

        //if (event.isPrimary === false) return;

        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        mouseOverObject = null;
        const pickedObject = checkIntersection()
        if (pickedObject) {
            mouseOverObject = pickedObject;
            outlinePass.selectedObjects = [pickedObject];
        } else {
            mouseOverObject = null;
            outlinePass.selectedObjects = [];
        }


    }


    function onMouseClick(event) {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const i = raycaster.intersectObject(scene, true);
        console.log(i[0].point)

        selectedObject = null;
        const pickedObject = checkIntersection()
        if (pickedObject) {
            setSideBar(pickedObject.userData);
            selectedObject = pickedObject;
            outlinePass.selectedObjects = [selectedObject];
            zoomInTimeline(
                pickedObject.position.x,
                pickedObject.position.y,
                pickedObject.position.z,
                700
            );
            controls.autoRotate = true;
        } else {
            resetSideBar();
            selectedObject = null;
            outlinePass.selectedObjects = [];
            controls.autoRotate = false;
        }

    }


    function checkIntersection() {
        raycaster.setFromCamera(mouse, camera);

        for (const siteId of siteIds) {
            const object = scene.getObjectById(siteId);
            const box = new THREE.Box3();
            box.setFromObject(object);
            const ray = new THREE.Ray();
            ray.copy(raycaster.ray)
            const intersects = ray.intersectsBox(box);
            if (intersects) {
                return object
            }
        }
        return null

    };

    const zoomInTimeline = (x, y, z, zoomOutFactor = 10) => {
        flight = gsap
            .timeline({ defaults: { duration: 5.5, ease: "expo.out" } })
            .to(controls.target, { x, y, z })
            .to(camera.position, { x, y, z: z + zoomOutFactor }, 0)
        //.to(group.rotation, { x: 0, y: 0 }, 0);
    };


    //Loaders
    const loadingManager = new THREE.LoadingManager();
    loadingManager.onLoad = function() {
        isSceneLoaded = true;
        if (isSceneStartedByUser) {
            setTimeout(() => {
                const overlay = document.getElementById('overlay');
                overlay.style.display = 'none';
                audioContext.resume();
            }, "3000");
        }
    };
    const modelLoader = new GLTFLoader(loadingManager);
    const audioLoader = new THREE.AudioLoader(loadingManager);

    //Load data
    const request = new Request("/public/sites.json");
    fetch(request)
        .then((response) => response.json())

        .then((data) => {
            for (const site of data) {
                loadSite(
                    site,
                    scene,
                    camera,
                    modelLoader,
                    audioLoader,
                    audioListener
                )
            }
        })

        .catch(console.error);




}


function loadSite(
    site,
    scene,
    camera,
    modelLoader,
    audioLoader,
    audioListener

) {
    if (!site.model) {
        return
    };


    //Creat site group
    const group = new THREE.Group();
    group.name = site.name;
    group.userData = {
        "name": site.name,
        "punjabi": site.punjabi,
        "description": site.description,
        "type": site.type,
        "province": site.province,
        "link": site.link,
    }


    group.position.set(
        site.position[0],
        site.position[1],
        site.position[2]
    )
    group.rotation.set(
        site.rotation[0],
        site.rotation[1],
        site.rotation[2]
    )
    group.scale.set(
        site.scale[0],
        site.scale[1],
        site.scale[2]
    )

    //Load model
    if (site.model) {
        let model;
        modelLoader.load(`https://ilyaly.github.io/enoa-khanid-interactive-map/public/models/${site.model}`, (gltf) => {
            model = gltf.scene;
            /*
            const toonMaterial = new THREE.MeshToonMaterial();
            model.traverse((node) => {
                if (node.isMesh) {
                    toonMaterial.emissiveMap = node.material.map;
                    node.material = toonMaterial;
                }
            });
            */
            group.add(model);
        });

    } else if (site.type !== "terrain") {
        const geometry = new THREE.BoxGeometry(10, 10, 10);
        const material = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const cube = new THREE.Mesh(geometry, material);
        group.add(cube);
    }


    // Load sound
    if (site.sound) {
        const sound = new THREE.PositionalAudio(audioListener);

        audioLoader.load(`https://ilyaly.github.io/enoa-khanid-interactive-map/public/sounds/${site.sound}`, function(buffer) {
            sound.setBuffer(buffer);
            sound.setLoop(true);
            sound.setRolloffFactor(1);
            sound.setDistanceModel("linear")
            //sound.setRefDistance(250); 
            sound.setMaxDistance(550);
            sound.setVolume(2);
            sound.play();
            group.add(sound);
        });
    }

    /*
    // Set label
    if (site.name && site.type !==
        "terrain") {

        const labelContainer = document.createElement('div');
        labelContainer.className = 'label';
        labelContainer.textContent = site.name;
        const label = new CSS3DObject(labelContainer);
        /*
        label.position.set(
            site.position[0],
            site.position[1],
            site.position[2]
        )
        
        //label.position.y += 50;

        group.add(label);
    }
    */

    //Add site to scene
    scene.add(group);

    if (site.type !== "terrain") {

        siteIds.push(group.id);
    }
}




function onWindowResize() {

    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
    composer.setSize(width, height);
    labelRenderer.setSize(width, height);

    effectFXAA.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);

    render();

}

function animate() {
    requestAnimationFrame(animate);
    controls.update();

    // Scroll the clouds texture
    cloudsTexture.offset.x += 0.0001;
    cloudsTexture.offset.y += 0.0001;

    render(scene, camera);

}

function render() {
    //renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
    composer.render();



}



const setSideBar = (data) => {
    const sidebar = document.getElementById('sidebar');
    sidebar.style.right = '-370px';
    sidebar.style.right = '0px';

    document.documentElement.style.setProperty('--hrContent', `'${data.punjabi}'`);
    //const hr = document.querySelector('hr');
    //hr.style.setProperty('--hrContent', );

    const header = document.getElementById("sidebar-content-header");
    header.innerHTML = data.name;

    const text = document.getElementById("sidebar-content-text");
    text.innerHTML = data.description;

    const link = document.getElementById("sidebar-content-link");
    link.setAttribute("href", data.link);

}

const resetSideBar = () => {
    const sidebar = document.getElementById('sidebar');
    sidebar.style.right = '-370px';
}