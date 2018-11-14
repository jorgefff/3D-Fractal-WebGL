//----------------------------------------------------------------------------
// Global Variables
//
var canvas = null;
var numLevels = 0;
var fractalSelected = 0;
var gl = null; // WebGL context
var shaderProgram = null;

// To allow choosing the way of drawing the model triangles
var primitiveType = null;
// To allow choosing the projection type
var projectionType = 0;

// The local transformation parameters
// The translation vector
var tx = 0.0;
var ty = 0.0;
var tz = 0.0;
// The rotation angles in degrees
var angleXX = -22.5;
var angleYY = 16.0;
var angleZZ = 0.0;
// The scaling factors
var sx = 0.5;
var sy = 0.5;
var sz = 0.5;

// Main
function runWebGL() {
	
	canvas = document.getElementById("my-canvas");
    
    initWebGL( canvas );

    shaderProgram = initShaders( gl );

    loadListeners();
    
}

// WebGL Initialization
function initWebGL( canvas ) {
	try {
		
		// Create the WebGL context
		// Some browsers still need "experimental-webgl"
		gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
		
		// DEFAULT: The viewport occupies the whole canvas 
		// DEFAULT: The viewport background color is WHITE
		// NEW - Drawing the triangles defining the model
		primitiveType = gl.TRIANGLES;
		
		// DEFAULT: Face culling is DISABLED
		// Enable FACE CULLING
		gl.enable( gl.CULL_FACE );
		
		// DEFAULT: The BACK FACE is culled!!
		// The next instruction is not needed...
		gl.cullFace( gl.BACK );
		
		// Enable DEPTH-TEST
		gl.enable( gl.DEPTH_TEST );
        
	} catch (e) {
	}
	if (!gl) {
		alert("Could not initialise WebGL, sorry! :-(");
	}        
}

// Button events
function loadListeners() {

    /* X - Rotation */
    document.getElementById("x-on-button").onclick = function(){
        console.log("x-on-button");
    };
    document.getElementById("x-off-button").onclick = function(){
        console.log("x-off-button");
    };
    document.getElementById("x-direction-button").onclick = function(){
        console.log("x-direction-button");
    };
    document.getElementById("x-slower-button").onclick = function(){
        console.log("x-slower-button");
    };
    document.getElementById("x-faster-button").onclick = function(){
        console.log("x-faster-button");
    };

    /* Y - Rotation */
    document.getElementById("y-on-button").onclick = function(){
        console.log("y-on-button");
    };
    document.getElementById("y-off-button").onclick = function(){
        console.log("y-off-button");
    };
    document.getElementById("y-direction-button").onclick = function(){
        console.log("y-direction-button");
    };
    document.getElementById("y-slower-button").onclick = function(){
        console.log("y-slower-button");
    };
    document.getElementById("y-faster-button").onclick = function(){
        console.log("y-faster-button");
    };

    /* Z - Rotation */
    document.getElementById("z-on-button").onclick = function(){
        console.log("z-on-button");
    };
    document.getElementById("z-off-button").onclick = function(){
        console.log("z-off-button");
    };
    document.getElementById("z-direction-button").onclick = function(){
        console.log("z-direction-button");
    };
    document.getElementById("z-slower-button").onclick = function(){
        console.log("z-slower-button");
    };
    document.getElementById("z-faster-button").onclick = function(){
        console.log("z-faster-button");
    };

    // Dropdown lists
	var list = document.getElementById("rendering-mode-selection");
	list.addEventListener("click", function() {

		var mode = list.selectedIndex;          // Getting the selection
		switch(mode){
			case 0 : primitiveType = gl.TRIANGLES;
				break;
			case 1 : primitiveType = gl.LINE_LOOP;
				break;
			case 2 : primitiveType = gl.POINTS;
				break;
		}
    });
    
    var projectionList = document.getElementById("projection-selection");
	projectionList.addEventListener("click", function() {

		var p = projectionList.selectedIndex;       // Getting the selection
		switch(p){
			case 0 : projectionType = 0;
				break;
			case 1 : projectionType = 1;
				break;
		}  
    });
    
    var fractalList = document.getElementById("fractal-selection");
	fractalList.addEventListener("click", function(){
		
		var mode = fractalList.selectedIndex;       // Getting the selection
		switch(mode){
			case 0 : 
				fractalSelected = 0;
				computeSierpinskiGasket();
				break;
		}
    });
    
    // Reset
    document.getElementById("reset-button").onclick = function(){
		
		// The initial values
		// The translation vector
		tx = 0.0;
		ty = 0.0;
		tz = 0.0;

		// The rotation angles in degrees
		angleXX = -22.5;
		angleYY = 16.0;
		angleZZ = 0.0;

		// The scaling factors
		sx = 0.5;
		sy = 0.5;
		sz = 0.5;
		
		// Local Animation controls
		rotationXX_ON = 0;
		rotationXX_DIR = 1;
		rotationXX_SPEED = 1;
		rotationYY_ON = 0;
		rotationYY_DIR = 1;
		rotationYY_SPEED = 1;
		rotationZZ_ON = 0;
		rotationZZ_DIR = 1;
		rotationZZ_SPEED = 1;
		projectionType = 0;
		kDiff = [ 0.2, 0.48, 0.72 ]; // COLOR

		initBuffers();      // needed here?
    };
    
    document.getElementById("dicrease-button").onclick = function(){
		if (numLevels > 0){
			numLevels = numLevels-1;
			document.getElementById("num-iterations").innerHTML = numLevels;
		}
		initBuffers();
    };
    
    document.getElementById("add-recursion-button").onclick = function(){
		numLevels = numLevels+1;
		document.getElementById("num-iterations").innerHTML = numLevels;

		switch(fractalSelected) {
			case 0 : 
			    computeSierpinskiGasket();
			    break;
			case 1 : 
				computeKochSnowflake();
				break;
			case 2 :
				computeMosely();
				break;
			case 3 : 
				computeMengerSponge();
				break;
			case 4 :
				computeJerusalemCube();
				break;
			case 5 :
				computeCantorDust();
				break;
		}
		initBuffers();
	};
	
}