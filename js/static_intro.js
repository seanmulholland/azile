var camera, scene, renderer;
var videoTexture,videoMaterial;
var composer;
var shaderTime = 0;
var badTVParams, badTVPass;		
var staticParams, staticPass;		
var rgbParams, rgbPass;	
var filmParams, filmPass;	
var renderPass, copyPass;
var pnoise, globalParams;

function initStatic() {

	camera = new THREE.PerspectiveCamera(55, 800/ 600, 20, 3000);
	camera.position.z = 1000;
	scene = new THREE.Scene();

	//init video texture
	videoTexture = new THREE.Texture( video );
	videoTexture.minFilter = THREE.LinearFilter;
	videoTexture.magFilter = THREE.LinearFilter;

	videoMaterial = new THREE.MeshBasicMaterial( {
		map: videoTexture
	} );
	videoMaterial.side = THREE.DoubleSide; // make material double sided


	//Add video plane
	var planeGeometry = new THREE.PlaneGeometry( 800, 600,1,1 );
	var plane = new THREE.Mesh( planeGeometry, videoMaterial );
	scene.add( plane );
	plane.z = 0;
	plane.scale.x = -1.45; // flip material for proper mirror effect
	plane.scale.y = 1.45;

	//init renderer
	renderer = new THREE.WebGLRenderer();
	renderer.setSize( 800, 600 );
	document.body.appendChild( renderer.domElement );

	//POST PROCESSING
	//Create Shader Passes
	renderPass = new THREE.RenderPass( scene, camera );
	badTVPass = new THREE.ShaderPass( THREE.BadTVShader );
	rgbPass = new THREE.ShaderPass( THREE.RGBShiftShader );
	filmPass = new THREE.ShaderPass( THREE.FilmShader );
	staticPass = new THREE.ShaderPass( THREE.StaticShader );
	copyPass = new THREE.ShaderPass( THREE.CopyShader );

	//set shader uniforms
	filmPass.uniforms.grayscale.value = 0;


	onToggleShaders();

	initParams();

	window.addEventListener('resize', onResize, false);
	onResize();

}


function initParams() {
	badTVPass.uniforms[ 'distortion' ].value = 20;
	badTVPass.uniforms[ 'distortion2' ].value = 20;
	badTVPass.uniforms[ 'speed' ].value = 0.2;
	badTVPass.uniforms[ 'rollSpeed' ].value = 0.12;
	rgbPass.uniforms[ 'angle' ].value = 0;
	rgbPass.uniforms[ 'amount' ].value = 0.07;
	staticPass.uniforms[ 'amount' ].value = 0.07;
	filmPass.uniforms[ 'sCount' ].value = 679;
	filmPass.uniforms[ 'sIntensity' ].value = 0.4;
	filmPass.uniforms[ 'nIntensity' ].value = 0.3;
}

function updateParams() {
	badTVPass.uniforms[ 'distortion' ].value = map_range(faceDistance,faceLow,faceHigh,20.0, 1.0);
	badTVPass.uniforms[ 'distortion2' ].value = map_range(faceDistance,faceLow,faceHigh,20.0, 1.2);
	badTVPass.uniforms[ 'speed' ].value = map_range(faceDistance,faceLow,faceHigh,20.0, 0.0);
	badTVPass.uniforms[ 'rollSpeed' ].value = map_range(faceDistance,faceLow,faceHigh,0.12, 0.0);
	rgbPass.uniforms[ 'amount' ].value = map_range(faceDistance,faceLow,faceHigh,0.07, 0.01);
	// staticPass.uniforms[ 'amount' ].value = map_range(faceDistance,faceLow,faceHigh,0.07, 0.03);
	// filmPass.uniforms[ 'sCount' ].value = map_range(faceDistance,faceLow,faceHigh,679.0, 0.0);
	filmPass.uniforms[ 'sIntensity' ].value = map_range(faceDistance,faceLow,faceHigh,0.4, 0.01);
	filmPass.uniforms[ 'nIntensity' ].value = map_range(faceDistance,faceLow,faceHigh,0.3, 0.0);
}


function onToggleShaders(){

	//Add Shader Passes to Composer
	//order is important 
	composer = new THREE.EffectComposer( renderer);
	composer.addPass( renderPass );

	composer.addPass( filmPass );
	composer.addPass( badTVPass );
	composer.addPass( rgbPass );
	composer.addPass( staticPass );

	composer.addPass( copyPass );
	copyPass.renderToScreen = true;
}

function animateStatic() {

	if (foundFace) {
		updateParams();
	}
	
	shaderTime += 0.1;
	badTVPass.uniforms[ 'time' ].value =  shaderTime;
	filmPass.uniforms[ 'time' ].value =  shaderTime;
	staticPass.uniforms[ 'time' ].value =  shaderTime;

	if ( video.readyState === video.HAVE_ENOUGH_DATA ) {
		if ( videoTexture ) videoTexture.needsUpdate = true;
	}

	composer.render( 0.1);

	if (faceDistance >= faceHigh) {
		$( '#overlay' ).fadeIn(1000); // show overlay tp indicate to user face is being recognized
		setTimeout(function () { // add a 2s delay and recheck to prevent false positives
		  	if (faceDistance >= faceHigh) {
	  			experienceBegin = true;
			} else {
				$( '#overlay' ).fadeOut(250); // hide overlay
			}
	  	}, 2000); 
	}
}

function onResize() {
	renderer.setSize(window.innerWidth, window.innerHeight);
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
}