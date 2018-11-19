//----------------------------------------------------------------------------
//
// Global Variables
//
var canvas = null;
var numLevels = 0;
var fractalSelected = 0;
var gl = null; // WebGL context
var shaderProgram = null;
var triangleVertexPositionBuffer = null;
var triangleVertexNormalBuffer = null;		//NEW

// The GLOBAL transformation parameters
var globalAngleYY = 0.0;
var globalTz = 0.0;

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

// GLOBAL Animation controls
var globalRotationYY_ON = 1;
var globalRotationYY_DIR = 1;
var globalRotationYY_SPEED = 1;

// Local Animation controls
var rotationXX_ON = 0;
var rotationXX_DIR = 1;
var rotationXX_SPEED = 1;
var rotationYY_ON = 0;
var rotationYY_DIR = 1;
var rotationYY_SPEED = 1;
var rotationZZ_ON = 0;
var rotationZZ_DIR = 1;
var rotationZZ_SPEED = 1;
 
// To allow choosing the way of drawing the model triangles
var primitiveType = null;
 
// To allow choosing the projection type
var projectionType = 0;

// NEW --- The viewer position
// It has to be updated according to the projection type
var pos_Viewer = [ 0.0, 0.0, 0.0, 1.0 ];

// NEW --- Point Light Source Features
// Directional --- Homogeneous coordinate is ZERO
var pos_Light_Source = [ 0.0, 0.0, 1.0, 0.0 ];

// White light
var int_Light_Source = [ 1.0, 1.0, 1.0 ];

// Low ambient illumination
var ambient_Illumination = [ 0.3, 0.3, 0.3 ];

// NEW --- Model Material Features
// Ambient coef.
var kAmbi = [ 0.2, 0.2, 0.2 ];

// Diffuse coef.
var kDiff = [ 0.2, 0.48, 0.72 ]; // COLOR

// Specular coef.
var kSpec = [ 0.0, 0.0, 0.0 ];

// Phong coef.
var nPhong = 100;

// Initial model has just ONE TRIANGLE
var vertices = [ ];
var normals = [ ];

// Main
function runWebGL() 
{
	canvas = document.getElementById("my-canvas");
	initWebGL( canvas );
	shaderProgram = initShaders( gl );
	initBuffers();
	tick();
    loadListeners();
}

// Handling the Vertex Coordinates and the Vertex Normal Vectors
function initBuffers() 
{	
	computeFractal()

	triangleVertexPositionBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, triangleVertexPositionBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
	triangleVertexPositionBuffer.itemSize = 3;
	triangleVertexPositionBuffer.numItems = vertices.length / 3;			

	// Associating to the vertex shader
	gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, 
			triangleVertexPositionBuffer.itemSize, 
			gl.FLOAT, false, 0, 0);
	
	// Vertex Normal Vectors
	triangleVertexNormalBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, triangleVertexNormalBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
	triangleVertexNormalBuffer.itemSize = 3;
	triangleVertexNormalBuffer.numItems = normals.length / 3;			

	// Associating to the vertex shader
	gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, 
			triangleVertexNormalBuffer.itemSize, 
			gl.FLOAT, false, 0, 0);	
}


function drawModel( angleXX, angleYY, angleZZ, 
	sx, sy, sz,
	tx, ty, tz,
	mvMatrix,
	primitiveType ) 
{

	// The the global model transformation is an input
	// Concatenate with the particular model transformations
	// Pay attention to transformation order !!
	mvMatrix = mult( mvMatrix, translationMatrix( tx, ty, tz ) );
	mvMatrix = mult( mvMatrix, rotationZZMatrix( angleZZ ) );
	mvMatrix = mult( mvMatrix, rotationYYMatrix( angleYY ) );
	mvMatrix = mult( mvMatrix, rotationXXMatrix( angleXX ) );
	mvMatrix = mult( mvMatrix, scalingMatrix( sx, sy, sz ) );
			
	// Passing the Model View Matrix to apply the current transformation
	var mvUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
	gl.uniformMatrix4fv(mvUniform, false, new Float32Array(flatten(mvMatrix)));

	// Multiplying the reflection coefficents
	var ambientProduct = mult( kAmbi, ambient_Illumination );
	var diffuseProduct = mult( kDiff, int_Light_Source );
	var specularProduct = mult( kSpec, int_Light_Source );

	// Associating the data to the vertex shader
	// This can be done in a better way !!
	// Vertex Coordinates and Vertex Normal Vectors
	initBuffers();

	// Partial illumonation terms and shininess Phong coefficient
	gl.uniform3fv( gl.getUniformLocation(shaderProgram, "ambientProduct"), 
	flatten(ambientProduct) );

	gl.uniform3fv( gl.getUniformLocation(shaderProgram, "diffuseProduct"),
	flatten(diffuseProduct) );

	gl.uniform3fv( gl.getUniformLocation(shaderProgram, "specularProduct"),
	flatten(specularProduct) );

	gl.uniform1f( gl.getUniformLocation(shaderProgram, "shininess"), 
	nPhong );

	//Position of the Light Source
	gl.uniform4fv( gl.getUniformLocation(shaderProgram, "lightPosition"),
	flatten(pos_Light_Source) );

	// Drawing 
	// primitiveType allows drawing as filled triangles / wireframe / vertices
	if( primitiveType == gl.LINE_LOOP ) 
	{
		// To simulate wireframe drawing!
		// No faces are defined! There are no hidden lines!
		// Taking the vertices 3 by 3 and drawing a LINE_LOOP
		var i;
		for( i = 0; i < triangleVertexPositionBuffer.numItems / 3; i++ ) 
		{
			gl.drawArrays( primitiveType, 3 * i, 3 ); 
		}
	}
	else 
	{			
		gl.drawArrays(primitiveType, 0, triangleVertexPositionBuffer.numItems); 
	}	
}


//  Drawing the 3D scene
function drawScene() 
{
	
	var pMatrix;
	var mvMatrix = mat4();
	
	// Clearing the frame-buffer and the depth-buffer
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	
	// Computing the Projection Matrix
	if( projectionType == 0 ) 
	{
		// For now, the default orthogonal view volume
		pMatrix = ortho( -1.0, 1.0, -1.0, 1.0, -1.0, 1.0 );
		// Global transformation !!
		globalTz = 0.0;
		// NEW --- The viewer is on the ZZ axis at an indefinite distance
		pos_Viewer[0] = pos_Viewer[1] = pos_Viewer[3] = 0.0;
		pos_Viewer[2] = 1.0;  

	}
	else 
	{	
		// A standard view volume.
		// Viewer is at (0,0,0)
		// Ensure that the model is "inside" the view volume
		pMatrix = perspective( 45, 1, 0.05, 15 );
		
		// Global transformation !!
		globalTz = -2.5;

		// NEW --- The viewer is on (0,0,0)
		pos_Viewer[0] = pos_Viewer[1] = pos_Viewer[2] = 0.0;
		pos_Viewer[3] = 1.0;  
	}
	
	// Passing the Projection Matrix to apply the current projection
	var pUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
	gl.uniformMatrix4fv(pUniform, false, new Float32Array(flatten(pMatrix)));
	
	// NEW --- Passing the viewer position to the vertex shader
	gl.uniform4fv( gl.getUniformLocation(shaderProgram, "viewerPosition"),
        flatten(pos_Viewer) );
	
	// GLOBAL TRANSFORMATION FOR THE WHOLE SCENE
	mvMatrix = translationMatrix( 0, 0, globalTz );
	
	// Instantianting the current model
	drawModel( angleXX, angleYY, angleZZ, 
	           sx, sy, sz,
	           tx, ty, tz,
	           mvMatrix,
	           primitiveType );
}


// WebGL Initialization
function initWebGL( canvas ) 
{
	try 
	{	
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
        
	}
	catch (e) 
	{}
	if (!gl) 
	{
		alert("Could not initialise WebGL, sorry! :-(");
	}        
}


var lastTime = 0;

function animate() 
{
	var timeNow = new Date().getTime();
	
	if( lastTime != 0 ) 
	{
		var elapsed = timeNow - lastTime;
		// Global rotation
		if( globalRotationYY_ON ) 
		{
			globalAngleYY += globalRotationYY_DIR * globalRotationYY_SPEED * (90 * elapsed) / 1000.0;
	    }

		// Local rotations
		if( rotationXX_ON ) 
		{
			angleXX += rotationXX_DIR * rotationXX_SPEED * (90 * elapsed) / 1000.0;
	    }
		if( rotationYY_ON ) 
		{
			angleYY += rotationYY_DIR * rotationYY_SPEED * (90 * elapsed) / 1000.0;
	    }
		if( rotationZZ_ON ) 
		{
			angleZZ += rotationZZ_DIR * rotationZZ_SPEED * (90 * elapsed) / 1000.0;
	    }
	}
	lastTime = timeNow;
}


//----------------------------------------------------------------------------
// Timer
function tick() 
{
	requestAnimFrame(tick);
	drawScene();
	animate();
}



// Button events
function loadListeners() {

    /* X - Rotation */
	document.getElementById("x-on-button").onclick = function()
	{
		rotationXX_ON = 1;
    };
    document.getElementById("x-off-button").onclick = function()
	{
		rotationXX_ON = 0;
    };
	document.getElementById("x-direction-button").onclick = function()
	{
        rotationXX_DIR = -rotationXX_DIR;
    };
	document.getElementById("x-slower-button").onclick = function()
	{
		rotationXX_SPEED *= 0.75;
    };
	document.getElementById("x-faster-button").onclick = function()
	{
		rotationXX_SPEED *= 1.25;
    };

    /* Y - Rotation */
    document.getElementById("y-on-button").onclick = function()
	{
        rotationYY_ON = 1;
    };
    document.getElementById("y-off-button").onclick = function()
	{
        rotationYY_ON = 0;
    };
    document.getElementById("y-direction-button").onclick = function()
	{
        rotationYY_DIR = -rotationYY_DIR;
    };
    document.getElementById("y-slower-button").onclick = function()
	{
		rotationYY_SPEED *= 0.75;
    };
    document.getElementById("y-faster-button").onclick = function()
	{
        rotationYY_SPEED *= 1.25;
    };

    /* Z - Rotation */
    document.getElementById("z-on-button").onclick = function()
	{
        rotationZZ_ON = 1;
    };
    document.getElementById("z-off-button").onclick = function()
	{
        rotationZZ_ON = 0;
    };
    document.getElementById("z-direction-button").onclick = function()
	{
        rotationZZ_DIR = -rotationZZ_DIR;
    };
    document.getElementById("z-slower-button").onclick = function()
	{
        rotationZZ_SPEED *= 0.75;
    };
    document.getElementById("z-faster-button").onclick = function()
	{
        rotationZZ_SPEED *= 1.25;
    };

    // Dropdown lists
	var list = document.getElementById("rendering-mode-selection");
	list.addEventListener("click", function() {

		var mode = list.selectedIndex;
		switch(mode)
		{
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

		var p = projectionList.selectedIndex;
		switch(p)
		{
			case 0 : projectionType = 0;
				break;
			case 1 : projectionType = 1;
				break;
		}  
    });
    
    var fractalList = document.getElementById("fractal-selection");
	fractalList.addEventListener("click", function()
	{
		
		var mode = fractalList.selectedIndex;
		switch(mode){
			case 0 : 
				fractalSelected = 0;
				break;
			case 1 : 
				fractalSelected = 1;
				break;
			case 2 :
				fractalSelected = 2;
				break;
			case 3 :
				fractalSelected = 3;
				break;
		}
    });
    
    // Reset
    document.getElementById("reset-button").onclick = function()
	{
		
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
    };
    
    document.getElementById("decrease-button").onclick = function()
	{
		if (numLevels > 0){
			numLevels = numLevels-1;
			document.getElementById("num-iterations").innerHTML = numLevels;
		}
    };
    
    document.getElementById("increase-button").onclick = function()
	{
		numLevels = numLevels+1;
		document.getElementById("num-iterations").innerHTML = numLevels;
	}; 
}


// Computes the currently selected fractal
function computeFractal()
{
	switch(fractalSelected) 
	{
		case 0 : 
			computeSierpinskiGasket();
			break;
	
		case 1 : 
			computeKochSnowflake();
			break;
		
		case 2 : 
			computeMengerSponge();
			break;
		
		case 3 :
			computeMosely();
			break;
	}
}

//------------------------------------------------------------------
// Fractal computing

//----------------------------------------------------------------
// Sierpinski Gasket
//----------------------------------------------------------------
function computeSierpinskiGasket()
{
    var v1 = [ -1.0,  0.0, -0.707 ];
    var v2 = [  0.0,  1.0,  0.707 ];
    var v3 = [  1.0,  0.0, -0.707 ];
    var v4 = [  0.0, -1.0,  0.707 ];

	vertices = [];
	normals = [];

	divideTetrahedron(v1, v2, v3, v4, numLevels);
	computeVertexNormals(vertices, normals);
}

function divideTetrahedron(v1, v2, v3, v4, recursionLevel) 
{
	if (recursionLevel == 0) 
	{
		var coordinatesToAdd = [].concat(v1, v2, v3,
            v3, v2, v4,
            v4, v2, v1,
            v1, v3, v4);
		for (var i = 0; i < 36; i += 1) 
		{
            vertices.push(coordinatesToAdd[i]);
        }
	}
	else 
	{
		var vertex12 = computeMidPoint(v1, v2);
		var vertex13 = computeMidPoint(v1, v3);
		var vertex14 = computeMidPoint(v1, v4);
		var vertex23 = computeMidPoint(v2, v3);
		var vertex24 = computeMidPoint(v2, v4);
		var vertex34 = computeMidPoint(v3, v4);

		recursionLevel--;

		divideTetrahedron(v1, vertex12, vertex13, vertex14, recursionLevel);
		divideTetrahedron(vertex12, v2, vertex23, vertex24, recursionLevel);
		divideTetrahedron(vertex13, vertex23, v3, vertex34, recursionLevel);
		divideTetrahedron(vertex14, vertex24, vertex34, v4, recursionLevel);
	}
}
//----------------------------------------------------------------
// Koch Snowflake
//----------------------------------------------------------------
function computeKochSnowflake() 
{
	// Initial vertices of the Tetrahedron
	var v1 = [ -1.0,  0.0, -0.707 ];
	var v2 = [  0.0,  1.0,  0.707 ];
	var v3 = [  1.0,  0.0, -0.707 ];
	var v4 = [  0.0, -1.0,  0.707 ];
		
	// Clearing the vertices array;
	vertices = [];
	normals = [];

	divideFace( v1, v2, v3, numLevels );		
	divideFace( v3, v2, v4, numLevels );
	divideFace( v4, v2, v1, numLevels );
	divideFace( v1, v3, v4, numLevels );

	addVertexes ( v1, v2, v3, v4);
	
	computeVertexNormals(vertices, normals);
}

function divideFace( v1, v2, v3, n )
{
	if ( n == 0 ) 
	{
		return;
	}
	
	else {
		// Compute new v
		var va = computeMidPoint( v1, v2);
		var vb = computeMidPoint( v2, v3);
		var vc = computeMidPoint( v1, v3);
		
		// Centroid
		var midpoint = computeCentroid( va, vb, vc );
		var normal;
		// Get the normal vector of this face
		var normalVector = computeNormalVector( v1, v2, v3 );
		
		// Using the height of an equilateral triangle
		var height = computeHeightofTriangle(computeDistance(va, vb ));
		normalVector[0] = normalVector[0] * height;			
		normalVector[1] = normalVector[1] * height;	
		normalVector[2] = normalVector[2] * height;
		
		var vH = addVector(midpoint, normalVector);
		n--;

		// 4 new line segments
		divideFace( va, vb, vH, n );
		divideFace( va, vH, vc, n );			
		divideFace( vb, vc, vH, n );
		divideFace( vb, vc, vH, n );
		
		addVertexes(vc, vb, va, vH);			
	}
}

function computeHeightofTriangle(side)
{
	var result = side / 2;
	result = result * Math.sqrt(3);
	return result;
}

function addVertexes ( v1, v2, v3, v4)
{	
	var coordinatesToAdd = [].concat(v1, v2, v3,
		v3, v2, v4,
		v4, v2, v1,
		v1, v3, v4);
	for (var i = 0; i < 36; i += 1) 
	{
		vertices.push(coordinatesToAdd[i]);
	}
}

function addVector( u, v )
{	
	var result = [];
	for ( var i = 0; i < u.length; ++i ) 
	{
		result.push( u[i] + v[i] );
	}

	return result;
}

function computeDistance (v1, v2)
{
	var aux = [v2[0]-v1[0], v2[1]-v1[1], v2[2]-v1[2]] 
	var squaresSum = aux[0] * aux[0] + aux[1] * aux[1] + aux[2] * aux[2];
    
    var res = Math.sqrt( squaresSum );
	
	return res;
}

//----------------------------------------------------------------
// Menger Sponge
//----------------------------------------------------------------
function computeMengerSponge() {
	var v1 = [-1, -1,  1];       
	var v2 = [ 1, -1,  1];        
	var v3 = [ 1,  1,  1];     
	var v4 = [-1,  1,  1];        
	var v5 = [-1, -1, -1];  
	var v6 = [ 1, -1, -1];       
	var v7 = [ 1,  1, -1];        
	var v8 = [-1,  1, -1];
	
	vertices = [];
	normals = [];
	
	mengerSponge(v1, v2, v3, v4, v5, v6, v7, v8, numLevels);
	computeVertexNormals(vertices, normals);
}

function defineCube(v1, v2, v3, v4, v5, v6, v7, v8)
{
	var toAdd = [].concat(v1, v2, v3,
                          v1, v3, v4,
                          v5, v8, v7,
                          v5, v7, v6,
                          v8, v4, v3,
                          v8, v3, v7,
                          v5, v6, v2,
                          v5, v2, v1,
                          v6, v7, v3,
                          v6, v3, v2,
                          v5, v1, v4,
                          v5, v4, v8);
        for (var i = 0; i < toAdd.length; i += 1) {
            vertices.push(toAdd[i]);
        }
}

function mengerSponge(v1, v2, v3, v4, v5, v6, v7, v8, recursionLevel) 
{	
	if(recursionLevel < 1) 
	{
		defineCube(v1, v2, v3, v4, v5, v6, v7, v8);
	}
	else 
	{
		recursionLevel--;
		
		// Divide every face into 9 squares

		var distance = computeDistance(v3, v4);
		var newDistance = distance / 3;
		
		// Front face cubes
		var front_top_left_1 = [v3[0] - distance, v3[1] - newDistance, v3[2]];
		var front_top_left_2 = [v3[0] - (2*newDistance), v3[1] - newDistance, v3[2]];
		var front_top_left_3 = [v3[0] - (2*newDistance), v3[1], v3[2]];
		var front_top_left_4 = [v3[0] - distance, v3[1], v3[2]];
		var front_top_left_5 = [front_top_left_1[0], front_top_left_1[1], front_top_left_1[2] - newDistance];
		var front_top_left_6 = [front_top_left_2[0], front_top_left_2[1], front_top_left_2[2] - newDistance];
		var front_top_left_7 = [front_top_left_3[0], front_top_left_3[1], front_top_left_3[2] - newDistance];
		var front_top_left_8 = [front_top_left_4[0], front_top_left_4[1], front_top_left_4[2] - newDistance];

		var front_top_mid_1 = front_top_left_2;
		var front_top_mid_2 = [v3[0] - newDistance, v3[1]-newDistance, v3[2]];
		var front_top_mid_3 = [v3[0] - newDistance, v3[1], v3[2]];
		var front_top_mid_4 = front_top_left_3;
		var front_top_mid_5 = [front_top_mid_1[0], front_top_mid_1[1], front_top_mid_1[2] - newDistance];
		var front_top_mid_6 = [front_top_mid_2[0], front_top_mid_2[1], front_top_mid_2[2] - newDistance];
		var front_top_mid_7 = [front_top_mid_3[0], front_top_mid_3[1], front_top_mid_3[2] - newDistance];
		var front_top_mid_8 = [front_top_mid_4[0], front_top_mid_4[1], front_top_mid_4[2] - newDistance];

		var front_top_right_1 = front_top_mid_2;
		var front_top_right_2 = [v3[0], v3[1]-newDistance, v3[2]];
		var front_top_right_3 = v3;
		var front_top_right_4 = front_top_mid_3;
		var front_top_right_5 = [front_top_right_1[0], front_top_right_1[1], front_top_right_1[2] - newDistance];
		var front_top_right_6 = [front_top_right_2[0], front_top_right_2[1], front_top_right_2[2] - newDistance];
		var front_top_right_7 = [front_top_right_3[0], front_top_right_3[1], front_top_right_3[2] - newDistance];
		var front_top_right_8 = [front_top_right_4[0], front_top_right_4[1], front_top_right_4[2] - newDistance];

		var front_mid_left_1 = [v3[0] - distance, v3[1]-(2*newDistance), v3[2]];
		var front_mid_left_2 = [v3[0] - (2*newDistance), v3[1]-(2*newDistance), v3[2]];
		var front_mid_left_3 = front_top_left_2;
		var front_mid_left_4 = front_top_left_1;
		var front_mid_left_5 = [front_mid_left_1[0], front_mid_left_1[1], front_mid_left_1[2] - newDistance];
		var front_mid_left_6 = [front_mid_left_2[0], front_mid_left_2[1], front_mid_left_2[2] - newDistance];
		var front_mid_left_7 = [front_mid_left_3[0], front_mid_left_3[1], front_mid_left_3[2] - newDistance];
		var front_mid_left_8 = [front_mid_left_4[0], front_mid_left_4[1], front_mid_left_4[2] - newDistance];

		var front_mid_right_1 = [v3[0] - newDistance, v3[1]-(2*newDistance), v3[2]];
		var front_mid_right_2 = [v3[0], v3[1]-(2*newDistance), v3[2]];
		var front_mid_right_3 = front_top_right_2;
		var front_mid_right_4 = front_top_right_1;
		var front_mid_right_5 = [front_mid_right_1[0], front_mid_right_1[1], front_mid_right_1[2] - newDistance];
		var front_mid_right_6 = [front_mid_right_2[0], front_mid_right_2[1], front_mid_right_2[2] - newDistance];
		var front_mid_right_7 = [front_mid_right_3[0], front_mid_right_3[1], front_mid_right_3[2] - newDistance];
		var front_mid_right_8 = [front_mid_right_4[0], front_mid_right_4[1], front_mid_right_4[2] - newDistance];

		var front_bot_left_1 = [v1[0], v1[1], v1[2]];
		var front_bot_left_2 = [v1[0] + newDistance, v1[1], v1[2]];
		var front_bot_left_3 = front_mid_left_2;
		var front_bot_left_4 = front_mid_left_1;
		var front_bot_left_5 = [front_bot_left_1[0], front_bot_left_1[1], front_bot_left_1[2] - newDistance];
		var front_bot_left_6 = [front_bot_left_2[0], front_bot_left_2[1], front_bot_left_2[2] - newDistance];
		var front_bot_left_7 = [front_bot_left_3[0], front_bot_left_3[1], front_bot_left_3[2] - newDistance];
		var front_bot_left_8 = [front_bot_left_4[0], front_bot_left_4[1], front_bot_left_4[2] - newDistance];

		var front_bot_mid_1 = front_bot_left_2;
		var front_bot_mid_2 = [v1[0] + (2*newDistance), v1[1], v1[2]];
		var front_bot_mid_3 = front_mid_right_1;
		var front_bot_mid_4 = front_bot_left_3;
		var front_bot_mid_5 = [front_bot_mid_1[0], front_bot_mid_1[1], front_bot_mid_1[2] - newDistance];
		var front_bot_mid_6 = [front_bot_mid_2[0], front_bot_mid_2[1], front_bot_mid_2[2] - newDistance];
		var front_bot_mid_7 = [front_bot_mid_3[0], front_bot_mid_3[1], front_bot_mid_3[2] - newDistance];
		var front_bot_mid_8 = [front_bot_mid_4[0], front_bot_mid_4[1], front_bot_mid_4[2] - newDistance];

		var front_bot_right_1 = front_bot_mid_2;
		var front_bot_right_2 = v2;
		var front_bot_right_3 = front_mid_right_2;
		var front_bot_right_4 = front_mid_right_1;
		var front_bot_right_5 = [front_bot_right_1[0], front_bot_right_1[1], front_bot_right_1[2] - newDistance];
		var front_bot_right_6 = [front_bot_right_2[0], front_bot_right_2[1], front_bot_right_2[2] - newDistance];
		var front_bot_right_7 = [front_bot_right_3[0], front_bot_right_3[1], front_bot_right_3[2] - newDistance];;
		var front_bot_right_8 = [front_bot_right_4[0], front_bot_right_4[1], front_bot_right_4[2] - newDistance];;

		// Mid cubes
		var mid_top_left_1 = front_top_left_5;
		var mid_top_left_2 = front_top_left_6;
		var mid_top_left_3 = front_top_left_7;
		var mid_top_left_4 = front_top_left_8;
		var mid_top_left_5 = [mid_top_left_1[0], mid_top_left_1[1], mid_top_left_1[2] - newDistance];
		var mid_top_left_6 = [mid_top_left_2[0], mid_top_left_2[1], mid_top_left_2[2] - newDistance];
		var mid_top_left_7 = [mid_top_left_3[0], mid_top_left_3[1], mid_top_left_3[2] - newDistance];
		var mid_top_left_8 = [mid_top_left_4[0], mid_top_left_4[1], mid_top_left_4[2] - newDistance];

		var mid_top_right_1 = front_top_right_5;
		var mid_top_right_2 = front_top_right_6;
		var mid_top_right_3 = front_top_right_7;
		var mid_top_right_4 = front_top_right_8;
		var mid_top_right_5 = [mid_top_right_1[0], mid_top_right_1[1], mid_top_right_1[2] - newDistance];
		var mid_top_right_6 = [mid_top_right_2[0], mid_top_right_2[1], mid_top_right_2[2] - newDistance];
		var mid_top_right_7 = [mid_top_right_3[0], mid_top_right_3[1], mid_top_right_3[2] - newDistance];
		var mid_top_right_8 = [mid_top_right_4[0], mid_top_right_4[1], mid_top_right_4[2] - newDistance];

		var mid_bot_left_1 = front_bot_left_5;
		var mid_bot_left_2 = front_bot_left_6;
		var mid_bot_left_3 = front_bot_left_7;
		var mid_bot_left_4 = front_bot_left_8;
		var mid_bot_left_5 = [mid_bot_left_1[0], mid_bot_left_1[1], mid_bot_left_1[2] - newDistance];
		var mid_bot_left_6 = [mid_bot_left_2[0], mid_bot_left_2[1], mid_bot_left_2[2] - newDistance];
		var mid_bot_left_7 = [mid_bot_left_3[0], mid_bot_left_3[1], mid_bot_left_3[2] - newDistance];
		var mid_bot_left_8 = [mid_bot_left_4[0], mid_bot_left_4[1], mid_bot_left_4[2] - newDistance];

		var mid_bot_right_1 = front_bot_right_5;
		var mid_bot_right_2 = front_bot_right_6;
		var mid_bot_right_3 = front_bot_right_7;
		var mid_bot_right_4 = front_bot_right_8;
		var mid_bot_right_5 = [mid_bot_right_1[0], mid_bot_right_1[1], mid_bot_right_1[2] - newDistance];
		var mid_bot_right_6 = [mid_bot_right_2[0], mid_bot_right_2[1], mid_bot_right_2[2] - newDistance];
		var mid_bot_right_7 = [mid_bot_right_3[0], mid_bot_right_3[1], mid_bot_right_3[2] - newDistance];
		var mid_bot_right_8 = [mid_bot_right_4[0], mid_bot_right_4[1], mid_bot_right_4[2] - newDistance];

		// Back cubes
		var back_top_left_1 = [front_top_left_1[0], front_top_left_1[1], front_top_left_1[2]-(2*newDistance)];
		var back_top_left_2 = [front_top_left_2[0], front_top_left_2[1], front_top_left_2[2]-(2*newDistance)];
		var back_top_left_3 = [front_top_left_3[0], front_top_left_3[1], front_top_left_3[2]-(2*newDistance)];
		var back_top_left_4 = [front_top_left_4[0], front_top_left_4[1], front_top_left_4[2]-(2*newDistance)];
		var back_top_left_5 = [back_top_left_1[0], back_top_left_1[1], back_top_left_1[2] - newDistance];
		var back_top_left_6 = [back_top_left_2[0], back_top_left_2[1], back_top_left_2[2] - newDistance];
		var back_top_left_7 = [back_top_left_3[0], back_top_left_3[1], back_top_left_3[2] - newDistance];
		var back_top_left_8 = [back_top_left_4[0], back_top_left_4[1], back_top_left_4[2] - newDistance];

		var back_top_mid_1 = [front_top_mid_1[0], front_top_mid_1[1], front_top_mid_1[2]-(2*newDistance)];
		var back_top_mid_2 = [front_top_mid_2[0], front_top_mid_2[1], front_top_mid_2[2]-(2*newDistance)];
		var back_top_mid_3 = [front_top_mid_3[0], front_top_mid_3[1], front_top_mid_3[2]-(2*newDistance)];
		var back_top_mid_4 = [front_top_mid_4[0], front_top_mid_4[1], front_top_mid_4[2]-(2*newDistance)];
		var back_top_mid_5 = [back_top_mid_1[0], back_top_mid_1[1], back_top_mid_1[2] - newDistance];
		var back_top_mid_6 = [back_top_mid_2[0], back_top_mid_2[1], back_top_mid_2[2] - newDistance];
		var back_top_mid_7 = [back_top_mid_3[0], back_top_mid_3[1], back_top_mid_3[2] - newDistance];
		var back_top_mid_8 = [back_top_mid_4[0], back_top_mid_4[1], back_top_mid_4[2] - newDistance];

		var back_top_right_1 = [front_top_right_1[0], front_top_right_1[1], front_top_right_1[2]-(2*newDistance)];
		var back_top_right_2 = [front_top_right_2[0], front_top_right_2[1], front_top_right_2[2]-(2*newDistance)];
		var back_top_right_3 = [front_top_right_3[0], front_top_right_3[1], front_top_right_3[2]-(2*newDistance)];
		var back_top_right_4 = [front_top_right_4[0], front_top_right_4[1], front_top_right_4[2]-(2*newDistance)];
		var back_top_right_5 = [back_top_right_1[0], back_top_right_1[1], back_top_right_1[2] - newDistance];
		var back_top_right_6 = [back_top_right_2[0], back_top_right_2[1], back_top_right_2[2] - newDistance];
		var back_top_right_7 = [back_top_right_3[0], back_top_right_3[1], back_top_right_3[2] - newDistance];
		var back_top_right_8 = [back_top_right_4[0], back_top_right_4[1], back_top_right_4[2] - newDistance];

		var back_mid_left_1 = [front_mid_left_1[0], front_mid_left_1[1], front_mid_left_1[2]-(2*newDistance)];
		var back_mid_left_2 = [front_mid_left_2[0], front_mid_left_2[1], front_mid_left_2[2]-(2*newDistance)];
		var back_mid_left_3 = [front_mid_left_3[0], front_mid_left_3[1], front_mid_left_3[2]-(2*newDistance)];
		var back_mid_left_4 = [front_mid_left_4[0], front_mid_left_4[1], front_mid_left_4[2]-(2*newDistance)];
		var back_mid_left_5 = [back_mid_left_1[0], back_mid_left_1[1], back_mid_left_1[2] - newDistance];
		var back_mid_left_6 = [back_mid_left_2[0], back_mid_left_2[1], back_mid_left_2[2] - newDistance];
		var back_mid_left_7 = [back_mid_left_3[0], back_mid_left_3[1], back_mid_left_3[2] - newDistance];
		var back_mid_left_8 = [back_mid_left_4[0], back_mid_left_4[1], back_mid_left_4[2] - newDistance];

		var back_mid_right_1 = [front_mid_right_1[0], front_mid_right_1[1], front_mid_right_1[2]-(2*newDistance)];
		var back_mid_right_2 = [front_mid_right_2[0], front_mid_right_2[1], front_mid_right_2[2]-(2*newDistance)];
		var back_mid_right_3 = [front_mid_right_3[0], front_mid_right_3[1], front_mid_right_3[2]-(2*newDistance)];
		var back_mid_right_4 = [front_mid_right_4[0], front_mid_right_4[1], front_mid_right_4[2]-(2*newDistance)];
		var back_mid_right_5 = [back_mid_right_1[0], back_mid_right_1[1], back_mid_right_1[2] - newDistance];
		var back_mid_right_6 = [back_mid_right_2[0], back_mid_right_2[1], back_mid_right_2[2] - newDistance];
		var back_mid_right_7 = [back_mid_right_3[0], back_mid_right_3[1], back_mid_right_3[2] - newDistance];
		var back_mid_right_8 = [back_mid_right_4[0], back_mid_right_4[1], back_top_right_4[2] - newDistance];

		var back_bot_left_1 = [front_bot_left_1[0], front_bot_left_1[1], front_bot_left_1[2]-(2*newDistance)];
		var back_bot_left_2 = [front_bot_left_2[0], front_bot_left_2[1], front_bot_left_2[2]-(2*newDistance)];
		var back_bot_left_3 = [front_bot_left_3[0], front_bot_left_3[1], front_bot_left_3[2]-(2*newDistance)];
		var back_bot_left_4 = [front_bot_left_4[0], front_bot_left_4[1], front_bot_left_4[2]-(2*newDistance)];
		var back_bot_left_5 = [back_bot_left_1[0], back_bot_left_1[1], back_bot_left_1[2] - newDistance];
		var back_bot_left_6 = [back_bot_left_2[0], back_bot_left_2[1], back_bot_left_2[2] - newDistance];
		var back_bot_left_7 = [back_bot_left_3[0], back_bot_left_3[1], back_bot_left_3[2] - newDistance];
		var back_bot_left_8 = [back_bot_left_4[0], back_bot_left_4[1], back_bot_left_4[2] - newDistance];

		var back_bot_mid_1 = [front_bot_mid_1[0], front_bot_mid_1[1], front_bot_mid_1[2]-(2*newDistance)];
		var back_bot_mid_2 = [front_bot_mid_2[0], front_bot_mid_2[1], front_bot_mid_2[2]-(2*newDistance)];
		var back_bot_mid_3 = [front_bot_mid_3[0], front_bot_mid_3[1], front_bot_mid_3[2]-(2*newDistance)];
		var back_bot_mid_4 = [front_bot_mid_4[0], front_bot_mid_4[1], front_bot_mid_4[2]-(2*newDistance)];
		var back_bot_mid_5 = [back_bot_mid_1[0], back_bot_mid_1[1], back_bot_mid_1[2] - newDistance];
		var back_bot_mid_6 = [back_bot_mid_2[0], back_bot_mid_2[1], back_bot_mid_2[2] - newDistance];
		var back_bot_mid_7 = [back_bot_mid_3[0], back_bot_mid_3[1], back_bot_mid_3[2] - newDistance];
		var back_bot_mid_8 = [back_bot_mid_4[0], back_bot_mid_4[1], back_bot_mid_4[2] - newDistance];

		var back_bot_right_1 = [front_bot_right_1[0], front_bot_right_1[1], front_bot_right_1[2]-(2*newDistance)];
		var back_bot_right_2 = [front_bot_right_2[0], front_bot_right_2[1], front_bot_right_2[2]-(2*newDistance)];
		var back_bot_right_3 = [front_bot_right_3[0], front_bot_right_3[1], front_bot_right_3[2]-(2*newDistance)];
		var back_bot_right_4 = [front_bot_right_4[0], front_bot_right_4[1], front_bot_right_4[2]-(2*newDistance)];
		var back_bot_right_5 = [back_bot_right_1[0], back_bot_right_1[1], back_bot_right_1[2] - newDistance];
		var back_bot_right_6 = [back_bot_right_2[0], back_bot_right_2[1], back_bot_right_2[2] - newDistance];
		var back_bot_right_7 = [back_bot_right_3[0], back_bot_right_3[1], back_bot_right_3[2] - newDistance];
		var back_bot_right_8 = [back_bot_right_4[0], back_bot_right_4[1], back_bot_right_4[2] - newDistance];

		mengerSponge(front_top_left_1, front_top_left_2, front_top_left_3, front_top_left_4, front_top_left_5, front_top_left_6, front_top_left_7, front_top_left_8, recursionLevel);
		mengerSponge(front_top_mid_1, front_top_mid_2, front_top_mid_3, front_top_mid_4, front_top_mid_5, front_top_mid_6, front_top_mid_7, front_top_mid_8, recursionLevel);
		mengerSponge(front_top_right_1, front_top_right_2, front_top_right_3, front_top_right_4, front_top_right_5, front_top_right_6, front_top_right_7, front_top_right_8, recursionLevel);
		mengerSponge(front_mid_left_1, front_mid_left_2, front_mid_left_3, front_mid_left_4, front_mid_left_5, front_mid_left_6, front_mid_left_7, front_mid_left_8, recursionLevel);
		mengerSponge(front_mid_right_1, front_mid_right_2, front_mid_right_3, front_mid_right_4, front_mid_right_5, front_mid_right_6, front_mid_right_7, front_mid_right_8, recursionLevel);
		mengerSponge(front_bot_left_1, front_bot_left_2, front_bot_left_3, front_bot_left_4, front_bot_left_5, front_bot_left_6, front_bot_left_7, front_bot_left_8, recursionLevel);
 		mengerSponge(front_bot_mid_1, front_bot_mid_2, front_bot_mid_3, front_bot_mid_4, front_bot_mid_5, front_bot_mid_6, front_bot_mid_7, front_bot_mid_8, recursionLevel);
		mengerSponge(front_bot_right_1, front_bot_right_2, front_bot_right_3, front_bot_right_4, front_bot_right_5, front_bot_right_6, front_bot_right_7, front_bot_right_8, recursionLevel);

		mengerSponge(mid_top_right_1, mid_top_right_2, mid_top_right_3, mid_top_right_4, mid_top_right_5, mid_top_right_6, mid_top_right_7, mid_top_right_8, recursionLevel);
		mengerSponge(mid_top_left_1, mid_top_left_2, mid_top_left_3, mid_top_left_4, mid_top_left_5, mid_top_left_6, mid_top_left_7, mid_top_left_8, recursionLevel);
		mengerSponge(mid_bot_left_1, mid_bot_left_2, mid_bot_left_3, mid_bot_left_4, mid_bot_left_5, mid_bot_left_6, mid_bot_left_7, mid_bot_left_8, recursionLevel);
		mengerSponge(mid_bot_right_1, mid_bot_right_2, mid_bot_right_3, mid_bot_right_4, mid_bot_right_5, mid_bot_right_6, mid_bot_right_7, mid_bot_right_8, recursionLevel);
 
		mengerSponge(back_top_left_1, back_top_left_2, back_top_left_3, back_top_left_4, back_top_left_5, back_top_left_6, back_top_left_7, back_top_left_8, recursionLevel);
		mengerSponge(back_top_mid_1, back_top_mid_2, back_top_mid_3, back_top_mid_4, back_top_mid_5, back_top_mid_6, back_top_mid_7, back_top_mid_8, recursionLevel);
		mengerSponge(back_top_right_1, back_top_right_2, back_top_right_3, back_top_right_4, back_top_right_5, back_top_right_6, back_top_right_7, back_top_right_8, recursionLevel);
		mengerSponge(back_mid_left_1, back_mid_left_2, back_mid_left_3, back_mid_left_4, back_mid_left_5, back_mid_left_6, back_mid_left_7, back_mid_left_8, recursionLevel);
		mengerSponge(back_mid_right_1, back_mid_right_2, back_mid_right_3, back_mid_right_4, back_mid_right_5, back_mid_right_6, back_mid_right_7, back_mid_right_8, recursionLevel);
		mengerSponge(back_bot_left_1, back_bot_left_2, back_bot_left_3, back_bot_left_4, back_bot_left_5, back_bot_left_6, back_bot_left_7, back_bot_left_8, recursionLevel);
		mengerSponge(back_bot_mid_1, back_bot_mid_2, back_bot_mid_3, back_bot_mid_4, back_bot_mid_5, back_bot_mid_6, back_bot_mid_7, back_bot_mid_8, recursionLevel);
		mengerSponge(back_bot_right_1, back_bot_right_2, back_bot_right_3, back_bot_right_4, back_bot_right_5, back_bot_right_6, back_bot_right_7, back_bot_right_8, recursionLevel);
 
	}
}
//----------------------------------------------------------------
// Mosely
//----------------------------------------------------------------
function computeMosely()
{
	var v1 = [-1, -1,  1];
    var v2 = [ 1, -1,  1];
    var v3 = [ 1,  1,  1];
    var v4 = [-1,  1,  1];        
    var v5 = [-1, -1, -1];
    var v6 = [ 1, -1, -1];
    var v7 = [ 1,  1, -1];
	var v8 = [-1,  1, -1];
	
	vertices = [];
	normals = [];

	mosely(v1, v2, v3, v4, v5, v6, v7, v8, numLevels);
	computeVertexNormals(vertices, normals);
}


function mosely(v1, v2, v3, v4, v5, v6, v7, v8, n)
{
	if(n==0)
	{
		defineCube(v1, v2, v3, v4, v5, v6, v7, v8);
	}
	else
	{
		n = n - 1;
		
		var v12 = interpolate(v1, v2, 0.33);
		var v13 = interpolate(v1, v3, 0.33);
		var v14 = interpolate(v1, v4, 0.33);
		var v15 = interpolate(v1, v5, 0.33);
		var v16 = interpolate(v1, v6, 0.33);
		var v17 = interpolate(v1, v7, 0.33);
		var v18 = interpolate(v1, v8, 0.33);
		
		var v21 = interpolate(v2, v1, 0.33);
		var v23 = interpolate(v2, v3, 0.33);
		var v24 = interpolate(v2, v4, 0.33);
		var v25 = interpolate(v2, v5, 0.33);
		var v26 = interpolate(v2, v6, 0.33);
		var v27 = interpolate(v2, v7, 0.33);
		var v28 = interpolate(v2, v8, 0.33);
		
		var v31 = interpolate(v3, v1, 0.33);
		var v32 = interpolate(v3, v2, 0.33);
		var v34 = interpolate(v3, v4, 0.33);
		var v35 = interpolate(v3, v5, 0.33);
		var v36 = interpolate(v3, v6, 0.33);
		var v37 = interpolate(v3, v7, 0.33);
		var v38 = interpolate(v3, v8, 0.33);
		
		var v41 = interpolate(v4, v1, 0.33);
		var v42 = interpolate(v4, v2, 0.33);
		var v43 = interpolate(v4, v3, 0.33);
		var v45 = interpolate(v4, v5, 0.33);
		var v46 = interpolate(v4, v6, 0.33);
		var v47 = interpolate(v4, v7, 0.33);
		var v48 = interpolate(v4, v8, 0.33);
		
		var v51 = interpolate(v5, v1, 0.33);
		var v52 = interpolate(v5, v2, 0.33);
		var v53 = interpolate(v5, v3, 0.33);
		var v54 = interpolate(v5, v4, 0.33);
		var v56 = interpolate(v5, v6, 0.33);
		var v57 = interpolate(v5, v7, 0.33);
		var v58 = interpolate(v5, v8, 0.33);
		
		var v61 = interpolate(v6, v1, 0.33);
		var v62 = interpolate(v6, v2, 0.33);
		var v64 = interpolate(v6, v4, 0.33);
		var v65 = interpolate(v6, v5, 0.33);
		var v63 = interpolate(v6, v3, 0.33);
		var v67 = interpolate(v6, v7, 0.33);
		var v68 = interpolate(v6, v8, 0.33);
		
		var v71 = interpolate(v7, v1, 0.33);
		var v72 = interpolate(v7, v2, 0.33);
		var v74 = interpolate(v7, v4, 0.33);
		var v75 = interpolate(v7, v5, 0.33);
		var v76 = interpolate(v7, v6, 0.33);
		var v73 = interpolate(v7, v3, 0.33);
		var v78 = interpolate(v7, v8, 0.33);
		
		var v81 = interpolate(v8, v1, 0.33);
		var v82 = interpolate(v8, v2, 0.33);
		var v84 = interpolate(v8, v4, 0.33);
		var v85 = interpolate(v8, v5, 0.33);
		var v86 = interpolate(v8, v6, 0.33);
		var v87 = interpolate(v8, v7, 0.33);
		var v83 = interpolate(v8, v3, 0.33);
		
		
		//vertex # 	    1    2    3    4    5    6    7    8
		mosely(v12, v21, v24, v13, v16, v25, v28, v17, n);
		mosely(v24, v23, v32, v31, v28, v27, v36, v35, n);
		mosely(v42, v31, v34, v43, v46, v35, v38, v47, n);
		mosely(v14, v13, v42, v41, v18, v17, v46, v45, n);
		mosely(v13, v24, v31, v42, v17, v28, v35, v46, n);
			
		mosely(v52, v61, v64, v53, v56, v65, v68, v57, n);
		mosely(v64, v63, v72, v71, v68, v67, v76, v75, n);
		mosely(v82, v71, v74, v83, v86, v75, v78, v87, n);
		mosely(v54, v53, v82, v81, v58, v57, v86, v85, n);
		mosely(v53, v64, v71, v82, v57, v68, v75, v86, n);
		
		mosely(v15, v16, v17, v18, v51, v52, v53, v54, n);
		mosely(v25, v26, v27, v28, v61, v62, v63, v64, n);
		mosely(v16, v25, v28, v17, v52, v61, v64, v53, n);
		
		mosely(v35, v36, v37, v38, v71, v72, v73, v74, n);
		mosely(v45, v46, v47, v48, v81, v82, v83, v84, n);
		mosely(v46, v35, v38, v47, v82, v71, v74, v83, n); 
		
		mosely(v18, v17, v46, v45, v54, v53, v82, v81, n);
		
		mosely(v46, v35, v38, v47, v82, v71, v74, v83, n);
		mosely(v28, v27, v36, v35, v64, v63, v72, v71, n);	
	}
}

function interpolate( u, v, s )
{		
	var result = [];
	for ( var i = 0; i < u.length; i++ )
	{
		result.push( (1.0 - s) * u[i] +  s * v[i] );
	}

	return result;
}