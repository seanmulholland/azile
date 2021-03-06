var video
var overlay;
var overlayCC;

var foundFace = false;
var faceDistance = 0;
var faceLow = 1.2;
var faceHigh = 1.7;

var experienceBegin = false;
var introComplete = false;

function initVariables() {
  // Face contour overlay
	overlay = document.getElementById('overlay');
	overlayCC = overlay.getContext('2d');
	createVideo();
}

function createVideo() {
	//Use webcam
	video = document.createElement('video');
	video.width = 320;
	video.height = 240;
	video.autoplay = true;
	video.loop = true;
	video.volume  = 0;
	//Webcam video
	window.URL = window.URL || window.webkitURL;
	navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
	//get webcam
	navigator.getUserMedia({
		video: true
	}, function(stream) {
		//on webcam enabled
		video.src = window.URL.createObjectURL(stream);
	}, function(error) {
		prompt.innerHTML = 'Unable to capture WebCam. Please reload the page.';
	});
};


function getDistance(lat1,lon1,lat2,lon2) {
  var dLat = deg2rad(lat2-lat1);  // deg2rad below
  var dLon = deg2rad(lon2-lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return c;
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}

function map_range(value, low1, high1, low2, high2) {
	value = Math.max(low1, Math.min(high1,value));
    return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
}