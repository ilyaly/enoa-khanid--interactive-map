//Basics
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
//Post-processing
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
//Loaders
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
//Animation
import { gsap } from 'https://cdn.skypack.dev/gsap@3.9.0';


// Basics
let scene, camera, renderer, controls;
// Post-processing
let composer, effectFXAA, outlinePass, renderPass, outputPass;
// Audio 
let audioListener;
// Objects
let pickedObject, mouseOverObject, selectedObject;
// Caster and var to store mouse
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

//Environment vars
let sun, cloudsTexture;
let isDay = true;

//State vars
let isSceneStartedByUser = false;
let isSceneLoaded = false;

//Audio
const audioContext = new(window.AudioContext || window.webkitAudioContext)();

// Base path
const basePath = 'https://ilyaly.github.io/enoa-khanid-interactive-map';

//Object IDs for picking
const objectSnapshots = [];

//Light
let ambientLight;

//Flight 
let flight;


init();
animate();
render();

function init() {
    //Scene
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10000);
    //Renderer
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.antialias = true;

    document.body.appendChild(renderer.domElement);

    //Camera

    camera.position.set(0, 4000, 0)
    camera.rotation.set(0, -0.45, 0)

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
    controls.zoomSpeed = 1;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.maxPolarAngle = Math.PI / 6;
    controls.maxDistance = 4000;
    controls.minDistance = 1000;
    controls.autoRotateSpeed = 0.25;

    //Controls bounds
    const minPan = new THREE.Vector3(-1500, -2300, -1500);
    const maxPan = new THREE.Vector3(1500, 2300, 1500);
    let _v = new THREE.Vector3();

    controls.addEventListener("change", function() {
        _v.copy(controls.target);
        controls.target.clamp(minPan, maxPan);
        _v.sub(controls.target);
        camera.position.sub(_v);
    });

    // Light
    ambientLight = scene.add(new THREE.AmbientLight(0x5c9fbc, 0.5));
    sun = new THREE.Group();
    let dLight = new THREE.DirectionalLight(0xFCE570, 1);
    sun.add(dLight);
    scene.add(sun);
    sun.rotation.z = Math.PI / 5;

    dLight.castShadow = true;
    dLight.shadow.mapSize.width = 1024;
    dLight.shadow.mapSize.height = 1024;

    dLight.shadow.camera.near = 0.5; // default
    dLight.shadow.camera.far = 2500; // default

    //Fog
    //scene.fog = new THREE.FogExp2(0x000000, 0.00025);


    //Audio
    audioListener = new THREE.AudioListener();
    camera.add(audioListener);

    //Post-processing
    composer = new EffectComposer(renderer);
    renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);
    outlinePass.edgeStrength = 5;
    outlinePass.edgeGlow = 0.0;
    outlinePass.edgeThickness = 2;
    composer.addPass(outlinePass);

    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    effectFXAA = new ShaderPass(FXAAShader);
    effectFXAA.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);
    composer.addPass(effectFXAA);

    //Renderer events
    window.addEventListener('resize', onWindowResize);
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('click', onMouseClick);
    renderer.domElement.addEventListener("pointerdown", (event) => {
        if (flight) {
            flight.kill();
        }
    });

    renderer.domElement.addEventListener("wheel", (event) => {
        if (flight) {
            flight.kill();
        }
    });


    //Loaders
    const loadingManager = new THREE.LoadingManager();
    loadingManager.onLoad = function() {
        isSceneLoaded = true;
        overlay.style.opacity = '50%';
        loader.style.opacity = "0%"
        playButton.style.opacity = "100%";
    };
    const modelLoader = new GLTFLoader(loadingManager);
    const audioLoader = new THREE.AudioLoader(loadingManager);
    const textureLoader = new THREE.TextureLoader();

    //Events
    function onPointerMove(event) {
        if (!isSceneLoaded || !isSceneStartedByUser) {
            return;
        };
        mouseOverObject = null;
        outlinePass.selectedObjects = [];

        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        pickedObject = checkIntersection();
        if (pickedObject) {
            mouseOverObject = pickedObject;
            outlinePass.selectedObjects = [mouseOverObject];
        } else {
            mouseOverObject = null;
            outlinePass.selectedObjects = [];
        };
    };

    function onMouseClick(event) {
        if (!isSceneLoaded || !isSceneStartedByUser) {
            return;
        };
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        pickedObject = checkIntersection();
        if (pickedObject) {
            selectObject(pickedObject);
        } else {
            unselectObject();
        };
    };

    function checkIntersection() {
        raycaster.setFromCamera(mouse, camera);

        for (const object of objectSnapshots) {
            const id = object.id;
            const box = new THREE.Box3(object.min, object.max);
            const ray = new THREE.Ray();
            ray.copy(raycaster.ray);
            const intersects = ray.intersectsBox(box);
            if (intersects) {

                const object = scene.getObjectById(id);
                return object;
            };
        }
        return null
    };

    function selectObject(object) {
        if (selectedObject) {
            const audio = selectedObject.getObjectByProperty("type", "Audio");
            if (audio) { audio.stop() };
        };

        selectedObject = object;

        const audio = selectedObject.getObjectByProperty("type", "Audio");
        if (audio) { audio.play() };
        setSideBar(object.userData);

        zoomToObject(object, 1200);
        controls.autoRotate = true;
    };

    function unselectObject() {
        if (selectedObject) {
            const audio = selectedObject.getObjectByProperty("type", "Audio");
            if (audio) { audio.stop() };
        };
        selectedObject = null;
        resetSideBar();

        controls.autoRotate = false;
    };

    function zoomToObject(object, zoomOutFactor = 10) {
        flight = gsap
            .timeline({ defaults: { duration: 5.5, ease: "expoScale(0.5,7,none)" } })
            .to(controls.target, {
                x: object.position.x,
                y: object.position.y,
                z: object.position.z
            })
            .to(camera.position, {
                x: object.position.x,
                y: object.position.y,
                z: object.position.z + zoomOutFactor
            }, 0)
    };


    // Add clouds
    cloudsTexture = textureLoader.load(`${basePath}/public/images/fx_cloudalpha05.png`);
    cloudsTexture.wrapS = THREE.RepeatWrapping;
    cloudsTexture.wrapT = THREE.RepeatWrapping;
    const planeGeometry = new THREE.PlaneGeometry(10000, 10000, 10, 10);
    const planeMaterial = new THREE.MeshPhysicalMaterial({ map: cloudsTexture, side: THREE.DoubleSide, transparent: true });
    const cloudsPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    cloudsPlane.position.set(0, 1000, 0);
    cloudsPlane.rotation.x = -1.57;
    scene.add(cloudsPlane);

    //Add terrain
    let terrainModel;
    modelLoader.load(`${basePath}/public/models/hanid-terrain-v3.glb`, (gltf) => {
        terrainModel = gltf.scene;
        const group = new THREE.Group();
        group.name = "Terrain";
        group.position.set(
            0,
            -300,
            0
        );
        group.rotation.set(
            0,
            0,
            0
        );
        group.scale.set(
            1000,
            1000,
            1000
        );
        group.add(terrainModel);
        scene.add(group);
    })

    // Add cities
    let sitesRequest = new Request(`${basePath}/public/cities.json`);
    fetch(sitesRequest)
        .then((response) => response.json())
        .then((cities) => {
            for (const city of cities) {
                //Creat city group
                const group = new THREE.Group();
                group.name = city.name;
                group.userData = {
                    "name": city.name,
                    "punjabi": city.punjabi,
                    "description": city.description,
                    "type": city.type,
                    "province": city.province,
                    "link": city.link,
                }

                group.position.set(
                    city.position[0],
                    city.position[1],
                    city.position[2]
                );
                group.rotation.set(
                    city.rotation[0],
                    city.rotation[1],
                    city.rotation[2]
                );
                group.scale.set(
                    city.scale[0],
                    city.scale[1],
                    city.scale[2]
                );

                //Load model
                if (city.model) {
                    let model;
                    modelLoader.load(`${basePath}/public/models/${city.model}`, (gltf) => {
                        model = gltf.scene;
                        group.add(model);
                        //This is for fast picking
                        const box = new THREE.Box3();
                        box.setFromObject(group);
                        objectSnapshots.push({
                            "id": group.id,
                            "min": box.min,
                            "max": box.max
                        });
                    });
                } else {
                    let model;
                    modelLoader.load(`${basePath}/public/models/placeholder-flag.glb`, (gltf) => {
                        model = gltf.scene;
                        group.add(model);
                        //This is for fast picking
                        const box = new THREE.Box3();
                        box.setFromObject(group);
                        objectSnapshots.push({
                            "id": group.id,
                            "min": box.min,
                            "max": box.max
                        });
                    });
                }

                // Load sound
                if (city.sound) {
                    const sound = new THREE.PositionalAudio(audioListener);

                    audioLoader.load(`${basePath}/public/sounds/${city.sound}`, function(buffer) {
                        sound.setBuffer(buffer);
                        sound.setLoop(true);
                        sound.setRolloffFactor(4);
                        sound.setRefDistance(500);
                        sound.setVolume(0.5);
                        group.add(sound);
                    });
                };
                scene.add(group);
            };
        })

        .catch(console.error);


    // Add places
    // As we use one model for all points of interest it is better to load model once 
    // and than use just copy it
    let placeModel;
    modelLoader.load(`${basePath}/public/models/poi-flag.glb`, (gltf) => {
        placeModel = gltf.scene;
        const placesRequest = new Request(`${basePath}/public/places.json`);
        fetch(placesRequest)
            .then((response) => response.json())
            .then((places) => {
                for (const place of places) {
                    const group = new THREE.Group();
                    group.name = place.name;
                    group.userData = {
                        "name": place.name,
                        "punjabi": place.punjabi,
                        "description": place.description,
                        "type": place.type,
                        "province": place.province,
                        "link": place.link,
                    };
                    group.position.set(
                        place.position[0],
                        place.position[1],
                        place.position[2]
                    );
                    group.rotation.set(
                        place.rotation[0],
                        place.rotation[1] += Math.random() * 2,
                        place.rotation[2]
                    );
                    group.scale.set(
                        place.scale[0],
                        place.scale[1],
                        place.scale[2]
                    );

                    group.add(placeModel.clone());
                    //This is for fast picking
                    const box = new THREE.Box3();
                    box.setFromObject(group);
                    objectSnapshots.push({
                        "id": group.id,
                        "min": box.min,
                        "max": box.max
                    });
                    scene.add(group);

                };


            })

            .catch(console.error);
    });

}

//Renders and animation

function onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
    composer.setSize(width, height);
    effectFXAA.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);
    render();

}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    cloudsTexture.offset.x += 0.0001;
    cloudsTexture.offset.y += 0.0001;
    render(scene, camera);

}

function render() {
    composer.render();
}

//GUI
const overlay = document.getElementById('overlay');
const loader = document.getElementById('diamond-loader');
const playButton = document.getElementById('playButton')
const dayNightSwitch = document.getElementById('day-night-switch');
const sidebar = document.getElementById('sidebar');

playButton.addEventListener('click', function() {
    isSceneStartedByUser = true;
    if (!isSceneLoaded) {
        return
    };

    overlay.style.opacity = '0%';
    overlay.style.pointerEvents = "none";
    playButton.style.pointerEvents = "none";

    flight = gsap.to(camera.position, {
        duration: 3,
        x: 0,
        y: 2300,
        z: 0,
        delay: 0.5,
        ease: "power3.inOut",
        onComplete: function() {
            controls.maxDistance = 2300;
        }
    });
    audioContext.resume();
});


dayNightSwitch.addEventListener('click', function() {
    if (!sun) {
        return
    }
    if (isDay) {
        dayNightSwitch.innerHTML = "☾";
        ambientLight.intensity = 0.5;
        gsap.to(sun.rotation, {
            duration: 7,
            x: 0,
            y: 0,
            z: Math.PI,
            delay: 0.5,
            ease: "power3.inOut",
        });
        isDay = false;
    } else {
        dayNightSwitch.innerHTML = "☉";
        ambientLight.intensity = 1;
        gsap.to(sun.rotation, {
            duration: 7,
            x: 0,
            y: 0,
            z: Math.PI / 4,
            delay: 0.5,
            ease: "power3.inOut",
        });
        isDay = true;
    }
});

const setSideBar = (data) => {
    sidebar.style.right = '0px';

    document.documentElement.style.setProperty('--hrContent', `'${data.punjabi}'`);

    const header = document.getElementById("sidebar-content-header");
    header.innerHTML = data.name;

    const text = document.getElementById("sidebar-content-text");
    text.innerHTML = data.description;

    const link = document.getElementById("sidebar-content-link");
    if (data.link) {
        link.setAttribute("href", data.link);
    } else {
        link.innerHTML = "";
    }


}

const resetSideBar = () => {
    const sidebar = document.getElementById('sidebar');
    sidebar.style.right = '-390px';
}