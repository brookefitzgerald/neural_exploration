$('.form-group').removeClass('row');

var margin = {top: 30, right: 13, bottom: 50, left: 60}

var svg = d3.select("svg#graph_svg");

// Setup window constants
var pixw = svg.style('width'),
w = pixw.slice(0,pixw["length"]-2)*1-margin.left-margin.right,
pixh = svg.style('height'),
h = pixh.slice(0,pixh["length"]-2)*1-margin.top-margin.bottom;

window.onresize = function(){
	pixw = svg.style('width');
	w = pixw.slice(0,pixw["length"]-2)*1-margin.left-margin.right;
	pixh = svg.style('height');
	h = pixh.slice(0,pixh["length"]-2)*1-margin.top-margin.bottom;
};

function range(x){
	return Array.from(Array(x).keys())
};

function round(number, precision=0) {
  var shift = function (number, precision, reverseShift) {
    if (reverseShift) {
      precision = -precision;
    }  
    numArray = ("" + number).split("e");
    return +(numArray[0] + "e" + (numArray[1] ? (+numArray[1] + precision) : precision));
  };
  return shift(Math.round(shift(number, precision, false)), precision, true);
}

var graph = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

var x_domain = {full: ()=>[0,1000], bin_150_50: ()=>range(18),bin_100_30: ()=>range(31), bin_50_15: range(64)};
var y_domain = {full: ()=>[0,1], bin_150_50: ()=>[0,1],bin_100_30: ()=>[0,1], bin_50_15: ()=>[0,1]};

// setup x 
var linearScale = d3.scaleLinear().range([0, w]),
xScale = linearScale,
bandScale = d3.scaleBand().range([0, w]),
xAxis = d3.axisBottom(xScale);

// setup y
var yScale = d3.scaleLinear().range([h, 0]), // value -> display
yAxis = d3.axisLeft(yScale);

// variables for color
var label_to_color_map = {guitar: "#8dd3c7", hand:"#ffe95c", flower: "#bebada", face: "#fb8072", couch:"#80b1d3", car: "#fdb462", kiwi: "#b3de69"},
color_to_ind_map = {"#8dd3c7":0, "#ffe95c":1, "#bebada":2, "#fb8072":3, "#80b1d3":4, "#fdb462":5, "#b3de69":6},
label_to_ind_map = {guitar: 0, hand:1, flower: 2, face: 3, couch:4, car: 5, kiwi: 6},
ind_to_color_map = ["#8dd3c7", "#ffe95c", "#bebada", "#fb8072", "#80b1d3", "#fdb462", "#b3de69"],
ind_to_label_map = ["guitar", "hand", "flower", "face", "couch", "car", "kiwi"];


// variables for data access
var neuron_a_number= 99,
neuron_b_number=16,
neuron_display_number = 99,
stimuli_display_number = 0,
prop_index = 9,
n_stimuli=0,
n_neurons = 132,
bin_id = 2,
bin = {1: "bin_150_50", 2: "bin_100_30", 3: "bin_50_15"}[bin_id],
bin_width = (isNaN(+bin.slice(4,7))? +bin.slice(4,6) : +bin.slice(4,7));


var initial_data = dataLoad('http://'+host+'/spike/data/'+(neuron_display_number+1)).then(function(response){
	let data = JSON.parse(response);
	data.data = data.data.map(trial=>trial.map(Number));
	n_stimuli=data.data.length;
	//make the x domain a function relying on stimuli display number, so when that number changes,the domain does too
	x_domain.full = ()=>[0, data.data[stimuli_display_number].length];
	return data}, function(Error) {
		console.log(Error);
});

var binned_data = dataLoad('http://'+host+'/spike/bin/'+bin_id+'/'+(neuron_display_number+1)).then(
	function(response) {
		let data = JSON.parse(response);
		data[bin] = data[bin].map(trial=>trial.map(Number));
		x_domain[bin] = ()=>range(data[bin+"_extents"].length);
		y_domain[bin] = function(i=stimuli_display_number){ return [0,d3.max(data[bin][i])]};

		y_domain[bin+"_full"] = [0,d3.max(d3.max(data[bin]))]
		return data;
	}, function(Error) {
		console.log(Error);
});

var single_neuron_color_data = binned_data.then(function(data){
	var color_data=[];
	for (var n in data[bin]){
		// add color data to every data point
		let formatted_data = data[bin][n].map(function(d,i){
			return({d:d, i:i, neuron: neuron_display_number, trial: +n, c: label_to_color_map[data.labels[n]]})});
		let original_data = JSON.parse(JSON.stringify(formatted_data));
		formatted_data = original_data.concat(formatted_data.map(function(d){
			d.i+=x_domain[bin]().length;
			return d}));
		color_data.push(formatted_data);
	}

	[average_color_data, ci_data]=calculate_avg_and_conf_intervals(data);
	return([data, color_data,average_color_data, ci_data]);
});

var confidence_intervals_with_fraction_of_data = single_neuron_color_data.then(function(data_all){
	[data, color_data,average_color_data, ci_data] = data_all;
	var proportional_conf_ints = [],
	props = range(9).map(d=>round(d/10+0.1, 2));
	proportional_conf_ints[9] = [average_color_data, ci_data];
	for (i in props){
		proportional_conf_ints[i] = calculate_avg_and_conf_intervals(data, props[i]);
	}
	return [data, proportional_conf_ints];
});


function calculate_avg_and_conf_intervals(data, prop = 1.0){
	var data_vec = new Array(x_domain[bin]().length).fill(0),
		sum_color_data = [[data_vec,0],[data_vec,0],[data_vec,0],[data_vec,0],[data_vec,0],[data_vec,0],[data_vec,0]],
		separated_color_data = [[],[],[],[],[],[],[]],
		average_list = [[],[],[],[],[],[],[]],
		std_list = [[],[],[],[],[],[],[]],
		ci_list = [[],[],[],[],[],[],[]],
		se=0,
		color_ind,
		size = round(data[bin].length*prop);
	for (var n in data[bin]){
		// add color data to every data point
		color_ind = label_to_ind_map[data.labels[n]];
		separated_color_data[color_ind].push(data[bin][n]);
	}
	var n_time_bins= separated_color_data[0][0].length;
	for (var i = 0; i<separated_color_data.length; i++) {
		separated_color_data[i] = separated_color_data[i].map((col, j) => separated_color_data[i].map(row => row[j]));
		//remove null values generated by transposing
		separated_color_data[i] = separated_color_data[i].slice(0,n_time_bins);

		for (var time_bin_i=0;time_bin_i<separated_color_data[i].length;time_bin_i++){
			if (prop==1.0){
				average_list[i][time_bin_i] = d3.mean(separated_color_data[i][time_bin_i]);
				std_list[i][time_bin_i] = d3.deviation(separated_color_data[i][time_bin_i]);
			} else {
				average_list[i][time_bin_i] = d3.mean(getRandomSubarray(separated_color_data[i][time_bin_i], size));
				std_list[i][time_bin_i] = d3.deviation(getRandomSubarray(separated_color_data[i][time_bin_i], size));	
			}
			se = std_list[i][time_bin_i]/Math.sqrt(separated_color_data[i][time_bin_i].length);
			ci_list[i][time_bin_i] = [average_list[i][time_bin_i]-se, average_list[i][time_bin_i]+se];
			
		}	
	}
	return ([average_list, ci_list]);
}

function d3ify_avg_color_data(average_list, n=neuron_display_number){
	let n_time_bins = average_list[0].length;
	average_list = average_list.map(function(e, color_ind){
		return e.map(function(d,i){
			return ({d:d, i:i, neuron: n, c: ind_to_color_map[color_ind]});
		})}); 
	original_data = JSON.parse(JSON.stringify(average_list));
	average_list = average_list.map(function(stimulus, s_i){
		return original_data[s_i].concat(stimulus.map(function(d){
			d.i+=n_time_bins;
			return d}));});
	return average_list;
}
/*

function calculate_confidence_intervals(separated_color_data, proportion_data=1.0){
	var t0 = performance.now();
	console.log("started calculating confidence ints by resampling");
	var n_colors=separated_color_data.length,
		n_showings = separated_color_data.map(color=>color.length),
		n_time_bins = separated_color_data[0][0].length,
		n_resamples = 5000;
	//transpose to get the color data in shape [n_colors, [n_time, [showings]]]
	for (var i = separated_color_data.length - 1; i >= 0; i--) {
		separated_color_data[i] = separated_color_data[i].map((col, j) => separated_color_data[i].map(row => row[j]));
		//remove null values generated by transposing
		separated_color_data[i] = separated_color_data[i].slice(0,n_time_bins);
	}

	var ci_list = [[],[],[],[],[],[],[]], 
	resampled_means = [[],[],[],[],[],[],[]];
	var random_indices, sum, low, high;
	
	for (var color_ind=0; color_ind<n_colors; color_ind++){
		for (var time_ind=0; time_ind<separated_color_data[color_ind].length; time_ind++){
			for (var i=n_resamples -1; i>=0;i-- ){
				random_indices = Array.from({length: proportion_data*n_showings[color_ind]}, () => Math.floor(Math.random() * n_showings[color_ind]));
				sum = random_indices.reduce(function(prevVal, elem){
					return prevVal+separated_color_data[color_ind][time_ind][elem]}, 0);
				if (typeof resampled_means[color_ind][time_ind]=="undefined"){
					// if this is the first time adding cis, create a list
					resampled_means[color_ind][time_ind]=[sum/n_showings[color_ind]];
				} else { //otherwise add them to he list 
					resampled_means[color_ind][time_ind].push(sum/n_showings[color_ind]);
				}
			}
			resampled_means[color_ind][time_ind].sort((a, b)=> a - b);
			low = resampled_means[color_ind][time_ind][Math.floor(0.025*n_resamples)];
			high = resampled_means[color_ind][time_ind][Math.floor(0.975*n_resamples)];
			ci_list[color_ind][time_ind] = [low, high];
		}
	}
	var t1 = performance.now();
	console.log("Call to get resampled conf ints took " + (t1 - t0) + " milliseconds.")
	return (ci_list);
}*/

function flatten(arr){
	return arr.reduce((acc, val) => acc.concat(val), []);
}

function normalize(single_neuron_data){
	flat_data = flatten(single_neuron_data)
	mean = d3.mean(flat_data);
	s = d3.deviation(flat_data);
	return(single_neuron_data.map(trial=>trial.map(d=>(d-mean)/s)));
}

var full_data = dataLoad('http://'+host+'/spike/bin/'+bin_id+'/').then(function(response) {
	// shape [n_neurons, [62, [31, 2]] d[0] = neuron 1
	// d[0][0] = neuron 1 average color data length 62
	var t0 = performance.now();
	var data = [];
	let full_data = JSON.parse(response);
	for (var n in full_data){
		full_data[n][bin] = full_data[n][bin].map(trial=>trial.map(Number));
		//[average_list, ci_list] = calculate_avg_and_conf_intervals(full_data[n]);
		data[n]= new Promise(function(resolve, reject) {resolve(calculate_avg_and_conf_intervals(full_data[n]))}); //[average_list, ci_list];
	}
	data = Promise.all(data);
	var t1 = performance.now();
	console.log("Call to get avg and conf ints took " + (t1 - t0) + " milliseconds.")
	return data;
});

var norm_full_data = full_data.then(function(data){
	var t0 = performance.now();
	var norm_data = [];
	for (var n in data){
		norm_data[n]= new Promise(function(resolve, reject) {
			resolve(normalize(data[n][0]))
		}); //[average_list, ci_list];
	}
	norm_data = Promise.all(norm_data);
	var t1 = performance.now();
	console.log("Call to normalize full data took " + (t1 - t0) + " milliseconds.")
	return norm_data;

});

var anova_data = dataLoad('http://'+host+'/spike/anova/'+bin_id).then(function(response){
	let data = JSON.parse(response);
	return data});

function scroll_text(text_data, time){
	svg.selectAll("text")
	.data(text_data)
	.enter()
	.append('text')
	.text(d=> d.text)
	.attr('class','code')
	.attr('x',d=>d.startx)
	.attr('y',(d,i)=>(i+1)*h/text_data.length)
	.transition()
	.duration(d=>d.duration)
	.ease(d3.easeLinear)
	.on("start", function repeat(d) {
		d3.active(this)
		.attr("x", w)
		.transition()
		.duration(0)
		.attr("x",-w/2)
		.transition()
		.duration(time)
		.on("start", repeat);
	});
	return;
}

function brain_pulse (){
	remove_all();
	// SVG of brain appearing with data streaming by
	time = 4000;
	text_data = [
	{text:'000100011000',startx: w-(w/3), duration: time/3*(2/3)},
	{text:'111000110101',startx: 0, duration: time*(2/3)},
	{text:'010000000001',startx: w/2, duration: time/2*(2/3)},
	{text:'101001000011',startx: w, duration: 0}
	];
	svg.select("#brain")
	.transition()
	.duration(0)
	.attr("x", 0)
	.attr("y",0)
	.attr("height",'90%')
	.attr("width",'90%');
	scroll_text(text_data, time);
	svg.select("image#neur-image")
	.attr("x", w/2)
	.attr("y",h/2)
	.attr("width", 0)
	.attr("height", 0)
	return;
}

function zoom_to_neuron(){
	remove_all();
	svg.select("image#neur-image")
		.attr("x", w/2)
		.attr("y",h/2)
		.attr("width", 0)
		.attr("height", 0)
	svg.select("#brain")
	.attr("x", 0)
	.attr("y",0)
	.attr("height",'90%')
	.attr("width",'90%')
	.transition()
	.ease(d3.easeExpIn)
	.duration(1000)
	.attr("x", -7*w)
	.attr("y",-6*h)
	.attr("width", "1200%")
	.attr("height", "1200%")
	.on("end", function(){
		d3.select(this)
		.attr("x", 0)
		.attr("y",0)
		.attr("width", 0)
		.attr("height", 0);
		svg.select("image#neur-image")
		.transition()
		.duration(1000)
		.attr("x", 0)
		.attr("y",0)
		.attr("width", "90%")
		.attr("height", "90%");
	});
	svg.selectAll("text").remove();
	return;
}

function neuron_spike(){
	remove_data();

	svg.select("image#neur-image")
		.attr("x", 0)
		.attr("y",0)
		.attr("width", "90%")
		.attr("height", "90%")
		.transition()
		.duration(100)
		.attr("transform", "rotate(3 "+w/2+" "+h/2+")")
		.transition()
		.duration(100)
		.attr("transform", "rotate(-6 "+w/2+" "+h/2+")")
		.transition()
		.duration(100)
		.attr("transform", "rotate(6 "+w/2+" "+h/2+")")
		.transition()
		.duration(100)
		.attr("transform", "rotate(-6 "+w/2+" "+h/2+")")
		.transition()
		.duration(100)
		.attr("transform", "rotate(3 "+w/2+" "+h/2+")");

	svg.select("#brain").attr("height",0);
	return;
}

function restart_active_animation(){
	graph.selectAll("*").transition();
	d3.selectAll(".section")
	.nodes()
	.map(function(e,i){
		if((e.classList.length >1) && (e.classList[1]=="graph-scroll-active")){
			section_animations[i]();
		}
	});
}

function get_active_section (){
	var sections = d3.selectAll(".section").nodes(),
	active_section;
	for (i in sections){
		if ((sections[i].classList.length>1) && (sections[i].classList[1]=="graph-scroll-active")){
			active_section = section_animations[i];
		}
	}
	return active_section;
}

function remove_data (){
	
	graph.selectAll("*").remove();
}
function remove_images(){
	svg.selectAll("*").transition().selection().attr("width",0);
}


function remove_all(){
	remove_data();
	remove_slider();
	remove_stimuli_and_index_change_buttons();
	remove_images();
}

function draw_stimuli_and_index_change_buttons(type="one", to_change="trial"){
	if (d3.selectAll("button.neuron").nodes().length==0){
		if (to_change=="trial"){
			$("#btn-text").text("Change Trial")
		} else if (to_change=="neuron"){
			$("#btn-text").text("Change Neuron")
		}
		d3.select("div#btn-container")
		.append("button")
		.text("<")
		.attr("class", "neuron")
		.attr("id","down")
		.on('click', function(){
			if (to_change=="trial"){
				stimuli_display_number=((stimuli_display_number== 0)? n_stimuli-1 : stimuli_display_number-1);
			} else if (to_change=="neuron"){
				neuron_display_number=((neuron_display_number== 0)? n_neurons-1 : neuron_display_number-1);
			}
			restart_active_animation()
		});
		d3.select("div#btn-container")
		.append("button")
		.text(">")
		.attr("class", "neuron")
		.attr("id","up")
		.on('click', function(){
			if (to_change=="trial"){
				stimuli_display_number=(((stimuli_display_number+1)== n_stimuli)? 0 : stimuli_display_number+1);
			} else if (to_change=="neuron"){
				neuron_display_number=(((neuron_display_number+1)== n_neurons)? 0 : neuron_display_number+1);
			}
			restart_active_animation()
		});

		draw_stimuli(type);
	}
}

function draw_stimuli(type="one"){
	if ($("image#stimuli").height()==0){
		initial_data.then(function(data){
			var img_width = 245;
			svg_width = $("#stimuli_svg").width(),
			rect_data = Array.from(ind_to_color_map.keys()),
			offset = (svg_width-img_width)/2,
			width= img_width/7;
			if (type=="one"){
				rect_data = [label_to_ind_map[data.labels_one[stimuli_display_number]]];
			}
			d3.select("image#stimuli")
			.attr("width","100%")
			.attr("height","40")
			.selectAll("rect").remove()
			
			d3.select("#stimuli_svg")
			.selectAll("rect")
			.data(rect_data)
			.enter()
			.append("rect")
			.attr("x",d=>offset+d*width+2)
			.attr("y",2)
			.attr("width", width-4)
			.attr("height", "40")
			.attr("fill", "none")
			.attr("stroke", d=>ind_to_color_map[d])
			.attr("stroke-width",4);
		});
	}
};

function remove_index_change_buttons (){
	d3.selectAll("button.neuron").remove();
}

function remove_stimuli_and_index_change_buttons(){
	d3.selectAll("button.neuron").remove();
	$("#btn-text").text("");
	d3.select("image#stimuli")
	.attr("width","0")
	.attr("height","0");
	d3.select("#stimuli_svg")
	.selectAll("rect")
	.remove();
}


function draw_x_axis(x_label, type, bin_extents=null){
	xAxis = d3.axisBottom(xScale);
	// x-axis
	if (type=="bins"){
		xAxis.tickFormat(n=>(bin_extents[n][0]-500)+"-"+(bin_extents[n][1]-500));
		var transform = "translate(-"+(xScale.bandwidth()+5)+",15) rotate(-45)",
		y_displacement = 50;
	} else {
		xAxis.tickFormat(n=>(n-500));
		var transform = "translate(0,0)",
		y_displacement = 30;
	}

	if (graph.selectAll("g.x").nodes().length==0){
		graph.append("g")
		.attr("class", "x axis")
		.attr("transform", "translate(0," + h + ")");
	}
	graph.selectAll("g.x")
	.call(xAxis)
	.selectAll("text")
	.attr("transform",transform);
	graph.selectAll(".x")
	.append("text")
	.attr("fill", "#000")
	.attr("x", w/2)
	.attr("y", y_displacement)
	.attr("text-anchor", "middle")
	.attr("class", "x label")
	.attr("transform", "translate(0,0)")
	.text(x_label);
}

function transition_x_axis(x_label, type, bin_extents=null, delay=0, duration=0) {
	xAxis = d3.axisBottom(xScale);
	// x-axis
	if (type=="bins"){
		xAxis.tickFormat(n=>(bin_extents[n][0]-500)+"-"+(bin_extents[n][1]-500));
		var transform = "translate(-"+(xScale.bandwidth()+5)+",15) rotate(-45)",
		y_displacement = 50;
	} else {
		xAxis.tickFormat(n=>(n-500));
		var transform = "translate(0,0)",
		y_displacement = 30;
	}
	graph.selectAll('.x.label')
	.transition()
	.delay(delay)
	.attr("y", y_displacement)
	.text(x_label);
	return(graph.select('.x')
	.transition()
	.delay(delay)
	.call(xAxis)
	.selection()
	.selectAll("text:not(.label)")
	.attr("transform", transform));
}

function draw_y_axis(y_label="Average Firing Rate (mHz)", type="continuous"){
	yAxis = d3.axisLeft(yScale);
	// y-axis
	if (type=="boolean"){
		yAxis.tickValues([0,1])
		.tickFormat(d3.format(".1"));
	} else if (type=="continuous"){
		yAxis.tickValues(null)
		.tickFormat(null);
	}
	if (graph.selectAll("g.y").nodes().length==0){
		graph.append("g")
		.attr("class", "y axis");
	}
	graph.selectAll("g.y")
	.call(yAxis)
	.append("text")
	.attr("fill", "#000")
	.attr("x", -h/2)
	.attr("y", -50)
	.attr("text-anchor", "middle")
	.attr("transform","rotate(-90)")
	.attr("class", "y label")
	.text(y_label);
}

function transition_y_axis(y_label="Average Firing Rate (mHz)", type="continuous", delay=0, duration=1000) {
	yAxis = d3.axisLeft(yScale);
	// y-axis
	if (type=="boolean"){
		yAxis.tickValues([0,1])
		.tickFormat(d3.format(".1"));
	} else if (type=="continuous"){
		yAxis.tickValues(null)
		.tickFormat(null);
	}
	return(graph.select('.y')
	.transition()
	.delay(delay)
	.duration(duration)
	.call(yAxis)
	.selection()
	.select(".label")
	.text(y_label));
}

function draw_spikes(){
	xScale = linearScale;
	xScale.domain(x_domain.full());
	yScale.domain(y_domain.full()); 
	initial_data.then(function(data){
		graph.append("g")
		.attr("class", "data")
		.selectAll("rect")
		.data(data.data[stimuli_display_number])
		.enter()
		.append("rect")
		.attr("x", function(d,i){
			return xScale(i);})
		.attr("y", d=>yScale(d))
		.attr("width", 1)
		.attr("height", d=>d*yScale(0))
		.attr("rx", 1/2)
		.attr("ry", 1/2);
	});
}
function single_neuron_spike_train(){
	// draws a single neuron spike train with axes
	remove_all()
	svg.select("image#neur-image")
		.attr("width", 0)
		.attr("height", 0);
	draw_spikes();
	draw_x_axis("Time before/after stimulus is shown (ms)", "full");
	draw_y_axis("Spike detected", "boolean");

	return;
}
function zoom_to_inferior_temporal_cortex(){
	remove_stimuli_and_index_change_buttons();
	return;
}
function show_stimuli(){
	single_neuron_spike_train();
	draw_stimuli_and_index_change_buttons();
	
	return;
}

function draw_average_firing_rate(data, data_length,line_width=2, opacity=1){
	xScale = bandScale.domain(x_domain[bin]());
	let n_g_bin_containers = graph.select("g.bins").nodes().length;
	if (n_g_bin_containers==0){ // adding a first graph
		graph.append("g").attr("class", "bins").data(data);
	}
	return(graph.select("g.bins")
		.selectAll("rect")
		.data(data)
		.enter()
		.append("rect")
		.attr("x",d=>xScale((d.i>=data_length) ? d.i-data_length : d.i))
		.attr("width", d=>(d.i>=data_length) ? line_width : xScale.bandwidth())
		.attr("y", function(d,i){
			if (d.i>data_length && d.d<data[i-data_length-1].d){
				y_value = yScale(data[i-data_length-1].d)
			} else {
				y_value = yScale(d.d)
			}
			return y_value;
		})
		.attr("height", function(d,i){
			height=line_width
			if (d.i>data_length){
				let y_diff = Math.abs(d.d-data[i-data_length-1].d);
				height= height+yScale(yScale.domain()[1]-y_diff);
			}
			return height;
		})
		.attr("rx", 1/2)
		.attr("ry", 1/2)
		.attr("opacity", opacity)
		.attr("stroke", d=>d.c)
		.attr("stroke-width",line_width)
		.attr("fill", function(d){
			return ((d.c=="#000000") ? "none": d.c)}));
}

function transition_average_firing_rate(data=null, data_length, selection=graph.select("g.bins").selectAll("rect"), line_width = 2, opacity=1){
	if (typeof data !== null){
		selection.data(data);
	}
	return (selection
		.transition()
		.duration(1000)
		.attr("x",d=>xScale((d.i>=data_length) ? d.i-data_length : d.i))
		.attr("width", d=>(d.i>=data_length) ? line_width : xScale.bandwidth())
		.attr("y", function(d,i){
			if (d.i>data_length && d.d<data[i-data_length-1].d){
				y_value = yScale(data[i-data_length-1].d)
			} else {
				y_value = yScale(d.d)
			}
			return y_value;
		})
		.attr("height", function(d,i){
			height=line_width
			if (d.i>data_length){
				let y_diff = Math.abs(d.d-data[i-data_length-1].d);
				height= height+yScale(yScale.domain()[1]-y_diff);
			}
			return height;
		})
		.attr("rx", 1/2)
		.attr("ry", 1/2)
		.attr("stroke",d=>d.c)
		.attr("stroke-width",line_width)
		.attr("opacity", opacity)
		.attr("fill", function(d){
			return ((d.c=="#000000") ? "none": d.c)}));
}

function bin_average (){
	remove_all();
	draw_spikes();
	draw_x_axis("Time before/after stimulus is shown (ms)", "full");
	draw_y_axis("Spike detected", "boolean");
	draw_stimuli_and_index_change_buttons();
	single_neuron_color_data.then(function(data_full){
		[data, color_data,average_color_data, ci_data] = data_full;
		let max_height=yScale(y_domain[bin]()[1]),
		spike_nodes = graph.selectAll(".data").selectAll(function() {return this.childNodes;}).nodes();
		graph.append("g")
		.attr("class", "bins")
		.selectAll("rect")
		.data(data[bin+"_extents"])
		.enter()
		.append("rect")
		.attr("x", d=>xScale(d[0]))
		.attr("y",0)
		.attr("height", yScale(0))
		.attr("width", d=>xScale(d[1]-d[0]))
		.attr("stroke-opacity", 0.0)
		.attr("stroke", "#EF476F")
		.attr("stroke-width",2)
		.attr("fill","none")
		.transition()
		.attr("stroke-opacity",1.0)
		.delay((d,i)=>((i==0) ? 500 : 2000))
		.duration(1000)
		.on("end", function(d,i){
			//If the last averaging bin has appeared
			if ((i==(data[bin+"_extents"].length-1))&& (get_active_section()==bin_average)){
				xScale = bandScale.domain(x_domain[bin]());
				let data_length = data[bin][stimuli_display_number].length;
				let graph_data = data[bin][stimuli_display_number].map(function(d,j){return {d:d,i:j, c: "#000000"}});
				transition_average_firing_rate(graph_data, data_length,
					graph.selectAll("g.bins")
					.selectAll("rect")
					.data(data[bin][stimuli_display_number].map(function(d,j){return {d:d,i:j, c: "#000000"}})))
				.on("start", function(d,j){
					spike_nodes.slice(j,j*bin_width).map(node=>node.remove());
					if (j==(x_domain[bin]().length-1)){
						transition_y_axis();
						transition_x_axis("Time bins before/after stimulus is shown (ms)", "bins", data[bin+"_extents"]);
					}})
				.on("end", function(d,j){
					if (j==0){
						new Promise(function(resolve, reject){
							let original_data = JSON.parse(JSON.stringify(graph_data));
							graph_data.map(function(d){
								d.i+=data_length;
								return d;})
							resolve(draw_average_firing_rate(original_data.concat(graph_data), data_length))
						})
						.then(()=>yScale.domain(y_domain[bin]()))
						.then(function(){
							transition_average_firing_rate(color_data[stimuli_display_number], data_length).delay(500);
							transition_y_axis("Average Firing Rate (mHz)", "continuous", 500);
						});
					}
				});
			}
		});
	});
	return;
}
function question(){
	remove_all();
	
	single_neuron_color_data.then(function(data_full){
		draw_stimuli_and_index_change_buttons();
		[data, color_data,average_color_data, ci_data] = data_full;
		xScale = bandScale.domain(x_domain[bin]());
		yScale.domain(y_domain[bin]());
		draw_y_axis("Average Firing Rate (mHz)", "continuous");
		draw_x_axis("Time bins before/after stimulus is shown (ms)", "bins", data[bin+"_extents"]);
		draw_average_firing_rate(color_data[stimuli_display_number], data[bin][stimuli_display_number].length);
	});
	return;
}

function getRandomSubarray(arr, size) {
	var shuffled = arr.slice(0), i = arr.length, min = i - size, temp, index;
	while (i-- > min) {
		index = Math.floor((i + 1) * Math.random());
		temp = shuffled[index];
		shuffled[index] = shuffled[i];
		shuffled[i] = temp;
	}
	return shuffled.slice(min);
}

function get_polygon_data(ci_list){
	polygon_data = [];
	for (var i = 0; i<ci_list.length; i++) {
		var highs = ci_list[i].map(time_bin=>time_bin[1]),
		lows = ci_list[i].map(time_bin=>time_bin[0]),
		n_time_bins = highs.length;
		polygon_data.push(highs.concat(lows.reverse()).map(function(d,j){
			return {y: d, c: ind_to_color_map[i],
				x: (j<n_time_bins) ? (j+1/2)*xScale.bandwidth(): (2*n_time_bins-j-1/2)*xScale.bandwidth()}
			}
			));
		polygon_data[i].splice(n_time_bins, 0, {x:xScale.bandwidth()*n_time_bins+2, c: ind_to_color_map[i],
			y: highs[n_time_bins-1]});
		polygon_data[i].splice(n_time_bins+1, 0, {x:xScale.bandwidth()*n_time_bins+2, c: ind_to_color_map[i],
			y: lows[n_time_bins-1]});
		polygon_data[i].unshift({x:0, c: ind_to_color_map[i], y: lows[n_time_bins-1]},{x:0, c: ind_to_color_map[i], y: highs[0]} );
	}
	return polygon_data
}

function draw_confidence_intervals(ci_list, opacity = 0.25){
	graph.selectAll("polygon")
		.data(get_polygon_data(ci_list))
		.enter()
		.append("polygon")
		.attr("points",function(p) {
			return p.map(function(d) {
				return [d.x,yScale(d.y)].join(",");
			}).join(" ");
		}).attr("fill", d=>d[0].c)
		.attr("opacity", opacity);
}

function transition_confidence_intervals(opacity=0.25, duration=1000){
	graph.selectAll("polygon")
		.transition()
		.duration(duration)
		.attr("points",function(p) {
			return p.map(function(d) {
				return [d.x,yScale(d.y)].join(",");
			}).join(" ");
		}).attr("fill", d=>d[0].c)
		.attr("opacity", opacity);
}

function trial_average(){
	yScale.domain(y_domain[bin]())
	remove_all();
	draw_stimuli("all");
	xScale = bandScale;
	xScale.domain(x_domain[bin]());
	single_neuron_color_data.then(function(data_full){
		[data, color_data, average_color_data_list, ci_data] = data_full;
		let data_length = average_color_data_list[0].length;
		average_color_data = flatten(d3ify_avg_color_data(average_color_data_list));
		color_data = flatten(color_data);
		draw_y_axis("Average Firing Rate (mHz)", "continuous");
		draw_x_axis("Time bins before/after stimulus is shown (ms)", "bins", data[bin+"_extents"]);
		// draw current stimulus line 
		let original_data = color_data.slice(stimuli_display_number*data_length*2,
			(stimuli_display_number+1)*data_length*2);
		
		// rescale to max
		var interval = 50, n_repeats = 100, delay = 2000;
		selection = setTimeout(function(){
			if (get_active_section()==trial_average){
				var selection = draw_average_firing_rate(original_data, data_length);
				transition_average_firing_rate(original_data, data_length, selection, line_width=1).delay(1000);
				return selection;
			}
		}, 0);

		setTimeout(function(){
			if (get_active_section()==trial_average){
				yScale.domain(y_domain[bin+"_full"]);
			}
		}, 500);

		setTimeout(function(selection){
			if (get_active_section()==trial_average){
				transition_y_axis("Average Firing Rate (mHz)", "continuous", delay=250);
				transition_average_firing_rate(original_data, data_length, selection, line_width=1).delay(250);
			}
		}, 505);

		setTimeout(function(){
			if (get_active_section()==trial_average){
				var data_indices = getRandomSubarray(range(420), n_repeats), sampled_data=original_data;
				var t = d3.interval(function(elapsed) {
					if ((elapsed >delay) && (get_active_section()==trial_average)){
						var i=data_indices[Math.round((elapsed-delay)/interval)];
						sampled_data = sampled_data.concat(color_data.slice(i*data_length*2, (i+1)*data_length*2))
						draw_average_firing_rate(sampled_data, data_length,1, 0.8);
					} if ((elapsed > interval*n_repeats+delay)|| get_active_section()!=trial_average){ 
						t.stop();
					}
				}, interval);
			}
		}, 1510);

		setTimeout(function(){
			if (get_active_section()==trial_average){
				d3.select("g.bins").attr("class", "remove");
				draw_confidence_intervals(ci_data, 1e-6);
				setTimeout(function(){
					graph.selectAll("polygon")
					.transition()
					.duration(1000)
					.attr("opacity",0.25);
				}, 1);
			}
		}, 1560+interval*n_repeats+delay);
		setTimeout(function(){
			if (get_active_section()==trial_average){
				draw_average_firing_rate(average_color_data, data_length,2,1e-6)
				.transition()
				.duration(1000)
				.attr("opacity",1.0);
				d3.select("g.remove").transition().delay(2000).duration(1000).attr("opacity", 1e-6).remove();
			}
		}, 1565+interval*n_repeats+delay);

		setTimeout(function(){
			if (get_active_section()==trial_average){
				yScale.domain([0,d3.max(flatten(flatten(ci_data)))]);
			}
		}, 1810+interval*n_repeats+delay);

		setTimeout(function(){
			if (get_active_section()==trial_average){
				transition_confidence_intervals();
				setTimeout(function(){
					transition_average_firing_rate(average_color_data, data_length,selection=graph.select("g.bins").selectAll("rect"),2)
					.duration(999)
				}, 1)
				transition_y_axis();
			}
		}, 2570+interval*n_repeats+delay);
		
	});
}

function draw_slider(){
	let slider_margin = {left: 15, right: 15},
	width = $("#btn-container").width()-slider_margin.left-slider_margin.right,
	height = 40;
	var x = d3.scaleQuantize()
	.domain([0, width])
	.range(range(10).map(d=>round(d/10+0.1, 1)));
	let slider_svg = d3.select("#btn-container").append("svg")
	.attr("class", "slider_svg")
	.attr("width", width+slider_margin.left+slider_margin.right)
	.attr("height", height);
	var slider = slider_svg.append("g")
	.attr("class", "slider")
	.attr("transform", "translate("+slider_margin.left+"," + height / 2 + ")");
	var prev_prop_index = prop_index;

	slider.append("line")
	.attr("class", "track")
	.attr("x1", x.domain()[0])
	.attr("x2", x.domain()[1])
	.select(function() { return this.parentNode.appendChild(this.cloneNode(true)); })
	.attr("class", "track-inset")
	.select(function() { return this.parentNode.appendChild(this.cloneNode(true)); })
	.attr("class", "track-overlay")
	.call(d3.drag()
		.on("start.interrupt", function() { slider.interrupt(); })
		.on("start drag", function() { 
			handle.attr("cx", width*x(d3.event.x)); 
	})
		.on("end", function() {
			handle.attr("cx", width*x(d3.event.x));
			prop_index = x(d3.event.x)*10-1;
			restart_active_animation();
		}));
	slider.insert("g", ".track-overlay")
	.attr("class", "ticks")
	.attr("transform", "translate(0," + 18 + ")")
	.selectAll("text")
	.data(x.range())
	.enter().append("text")
	.attr("x",d=>d*width)
	.attr("text-anchor", "middle")
	.text(function(d) { return d*100+"%";});

	var handle = slider.insert("circle", ".track-overlay")
	.attr("class", "handle")
	.attr("r", 9)
	.attr("cx", width*round(prop_index/10+0.1, 1));
	$("#btn-text").text("Percent of data used")
}

function remove_slider(){
	$(".slider_svg").remove();
}

function confidence_intervals(){
	remove_all();
	draw_slider();
	draw_stimuli("all");
	neuron_display_number = neuron_a_number; // in case the user scrolls from neuron flip through to here
	confidence_intervals_with_fraction_of_data.then(function(data_all){
		[data, proportional_conf_ints] = data_all;
		[average_color_data_list, ci_data] = proportional_conf_ints[prop_index];
		yScale.domain([0,d3.max(flatten(flatten(ci_data)))]);
		xScale = bandScale;
		xScale.domain(x_domain[bin]());
		let data_length = average_color_data_list[0].length;

		average_color_data = flatten(d3ify_avg_color_data(average_color_data_list));
		setTimeout( function(){
			draw_confidence_intervals(ci_data);
			setTimeout( function(){
				draw_average_firing_rate(average_color_data, data_length,2);
			});
			draw_x_axis("Time bins before/after stimulus is shown (ms)", "bins", data[bin+"_extents"]);
			draw_y_axis("Average Firing Rate (mHz)", "continous");
		});
	});
	return;
}
function neuron_flip_through(){
	remove_all();
	draw_stimuli_and_index_change_buttons("all", "neuron");

	full_data.then(function(data){
		[average_color_data, confidence_intervals] = data[neuron_display_number];
		yScale.domain([0,d3.max(flatten(flatten(confidence_intervals)))]);
		xScale = bandScale;
		xScale.domain(x_domain[bin]());
		let data_length = average_color_data[0].length;
		
		average_color_data = flatten(d3ify_avg_color_data(average_color_data));
		draw_confidence_intervals(confidence_intervals);
		setTimeout( function(){
			draw_average_firing_rate(average_color_data, data_length,2);
		}, 2);
		binned_data.then((data)=> draw_x_axis("Time bins before/after stimulus is shown (ms)", "bins", data[bin+"_extents"]));
		draw_y_axis("Average Firing Rate (mHz)", "continous");
	});
	return;
}
function neuron_information_comparison(){
	remove_all();
	return;
}
function compared_neuron_averaging(){
	return;
}
function compared_neuron_separation(){
	return;
}
function no_information_expectation(){
	return;
}
function average_firing_rate_histogram(){
	return;
}
function percent_selective_per_bin_hist_on_hover(){
	return;
}
function overall_percent_selective_top_three_filter(){
	return;
}
function machine_animation(){
	return;
}
function data_predictive_accuracy_collected_in_time_bin_graph(){
	return;
}
function swapped_data_null_accuracy_collected_in_time_bin_graph(){
	return;
}
function accuracy_compared_with_null_distribution_creation(){
	return;
}
function predictions_with_most_selective_neurons(){
	return;
}
function what_we_learned(){
	return;
}
function conclusion(){
	return;
}

var section_animations = {
	0: brain_pulse,
	1: zoom_to_neuron,
	2: neuron_spike,
	3: single_neuron_spike_train,
	4: zoom_to_inferior_temporal_cortex,
	5: show_stimuli,
	6: bin_average,
	7: question,
	8: trial_average,
	9: confidence_intervals,
	10: neuron_flip_through,
	11: neuron_information_comparison,
	12: compared_neuron_averaging,
	13: compared_neuron_separation,
	14: no_information_expectation,
	15: average_firing_rate_histogram,
	16: percent_selective_per_bin_hist_on_hover,
	17: overall_percent_selective_top_three_filter,
	18: machine_animation,
	19: data_predictive_accuracy_collected_in_time_bin_graph,
	20: swapped_data_null_accuracy_collected_in_time_bin_graph,
	21: accuracy_compared_with_null_distribution_creation,
	22: predictions_with_most_selective_neurons,
	23: what_we_learned,
	24: conclusion
}

d3.graphScroll()
.graph(d3.selectAll('#graph'))
.container(d3.select('#container'))
.sections(d3.selectAll('#sections > div'))
.on('active', function(i){ 
	section_animations[i]();
});


