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

function range(x, by=1){
	return Array.from(Array(round(x/by)).keys()).map(x=>x*by);
};

var graph = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

var x_domain = {full: ()=>[0,1000], bin_150_50: ()=>range(18),bin_100_30: ()=>range(31), bin_50_15: range(64)};
var y_domain = {full: ()=>[0,1], bin_150_50: ()=>[0,1],bin_100_30: ()=>[0,1], bin_50_15: ()=>[0,1]};

// setup x 
var linearScale = d3.scaleLinear().range([0, w]),
xScale = linearScale,
bandScale = d3.scaleBand().range([0, w]),
xAxis = d3.axisBottom(xScale);

// setup y
var logScale = d3.scaleLog().base([10]).range([h,0]),
yLinearScale = d3.scaleLinear().range([h, 0]), // value -> display
yScale = yLinearScale,
yAxis = d3.axisLeft(yScale);

// variables for color
var label_to_color_map = {guitar: "#8dd3c7", hand:"#ffe95c", flower: "#bebada", face: "#fb8072", couch:"#80b1d3", car: "#fdb462", kiwi: "#b3de69"},
color_to_ind_map = {"#8dd3c7":0, "#ffe95c":1, "#bebada":2, "#fb8072":3, "#80b1d3":4, "#fdb462":5, "#b3de69":6},
label_to_ind_map = {guitar: 0, hand:1, flower: 2, face: 3, couch:4, car: 5, kiwi: 6},
ind_to_color_map = ["#8dd3c7", "#ffe95c", "#bebada", "#fb8072", "#80b1d3", "#fdb462", "#b3de69"],
ind_to_label_map = ["guitar", "hand", "flower", "face", "couch", "car", "kiwi"];


// variables for data access
var neuron_a_number= (host=="localhost:8000")? 99: 76,
neuron_b_number=(host=="localhost:8000")? 16: 87,
neuron_display_number = (host=="localhost:8000")? 99: 76,
stimuli_display_number = 0,
prop_index = 9,
pre_time_bin_index = 10,
post_time_bin_index = 20,
n_stimuli=ind_to_label_map.length,
n_trials =0,
n_neurons = 132,
bin_id = 2,
bin = {1: "bin_150_50", 2: "bin_100_30", 3: "bin_50_15"}[bin_id],
bin_width = (isNaN(+bin.slice(4,7))? +bin.slice(4,6) : +bin.slice(4,7)),
time_bin_index=post_time_bin_index,
url_prepend =	(host=="localhost:8000")? 'http://'+host:"https://"+host;

//variables for easy computation
var a_mean=0,
b_mean=0,
a_sd=0,
b_sd=0,
slider_has_not_been_set=true,
curr_val_index = 9;

var initial_data = dataLoad(url_prepend+'/spike/data/'+(neuron_display_number+1)).then(function(response){
	let data = JSON.parse(response);
	data.data = data.data.map(trial=>trial.map(Number));
	n_trials=data.data.length;
	//make the x domain a function relying on stimuli display number, so when that number changes,the domain does too
	x_domain.full = ()=>[0, data.data[stimuli_display_number].length];
	return data}, function(Error) {
		console.log(Error);
});

var binned_data = dataLoad(url_prepend+'/spike/bin/'+bin_id+'/'+(neuron_display_number+1)).then(
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
		n,
		random_subarray;
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
				n=separated_color_data[i][time_bin_i].length;
			} else {
				n=round(separated_color_data[i][time_bin_i].length*prop);
				random_subarray = getRandomSubarray(separated_color_data[i][time_bin_i], n);
				average_list[i][time_bin_i] = d3.mean(random_subarray);
				std_list[i][time_bin_i] = d3.deviation(random_subarray);
			}
			se = std_list[i][time_bin_i]/Math.sqrt(n);
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

function normalize(single_neuron_data, cis){
	flat_data = flatten(single_neuron_data)
	mean = d3.mean(flat_data);
	s = d3.deviation(flat_data);
	var to_return = single_neuron_data.map(trial=>trial.map(d=>(d-mean)/s));
	if (typeof cis !="undefined"){
		to_return = [to_return,cis.map(trial=>trial.map(ci=>ci.map(d=>(d-mean)/s)))];
	}
	return(to_return);
}

var full_data = dataLoad(url_prepend+'/spike/bin/'+bin_id+'/').then(function(response) {
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
}).then(function(data){
	let [a_average_color_data, a_norm_cis] = data[neuron_a_number],
		[b_average_color_data, b_norm_cis] = data[neuron_b_number],
		a_flat_data = flatten(flatten(a_average_color_data)),
		b_flat_data = flatten(flatten(b_average_color_data));
	b_mean = d3.mean(b_flat_data);
	b_sd = d3.deviation(b_flat_data);
	a_sd = d3.deviation(a_flat_data);
	a_mean = d3.mean(a_flat_data);
	return data
});;

var norm_full_data = full_data.then(function(data){
	var t0 = performance.now();
	var norm_data = [];
	for (var n in data){
		norm_data[n]= new Promise(function(resolve, reject) {
			resolve(normalize(data[n][0], data[n][1]));
		}); //[average_list, ci_list];
	}
	norm_data = Promise.all(norm_data);
	var t1 = performance.now();
	console.log("Call to normalize full data took " + (t1 - t0) + " milliseconds.")
	return norm_data;
});

var anova_data = dataLoad(url_prepend+'/spike/anova/'+bin_id).then(function(response){
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
	var points = [
		[480, 200],
		[580, 400],
		[680, 100],
		[780, 300],
		[180, 300],
		[280, 100],
		[380, 400]
	];
	remove_data();
	/*
	var path = svg.append("path")
		.data([points])
		.attr("d", d3.line()
			.x(function(d) { return x; })
			.y(function(d) { return y; })
			.curve(d3.curveCardinal()));

	svg.append("path")
		.attr("d", line)
		.call(transition);

	function transition(path) {
		path.transition()
				.duration(7500)
				.attrTween("stroke-dasharray", tweenDash)
				.each("end", function() { d3.select(this).call(transition); });
	}

	function tweenDash() {
		var l = this.getTotalLength(),
				i = d3.interpolateString("0," + l, l + "," + l);
		return function(t) { return i(t); };
	}
	}*/
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
	svg.selectAll("*").transition().duration(0).attr("width",0);
}


function remove_all(){
	remove_images();
	remove_data();
	remove_slider();
	remove_stimuli_and_index_change_buttons();
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
				stimuli_display_number=((stimuli_display_number== 0)? n_trials-1 : stimuli_display_number-1);
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
				stimuli_display_number=(((stimuli_display_number+1)== n_trials)? 0 : stimuli_display_number+1);
			} else if (to_change=="neuron"){
				neuron_display_number=(((neuron_display_number+1)== n_neurons)? 0 : neuron_display_number+1);
			}
			restart_active_animation()
		});

		draw_stimuli(type);
	}
}
var current_pre_status = "inactive",
	current_post_status = "active";
function draw_time_bin_buttons(){
	$("#btn-text").text("Time Bin");
	d3.select("div#btn-container")
		.append("label")
		.attr("class", current_pre_status)
		.append("input")
		.attr("name", "toggle")
		.attr("type", "radio")
		.attr("id","pre")
		.on('change', function(){
			if (current_pre_status=="inactive"){
				d3.select("label."+current_pre_status).attr("class", "active");
				current_pre_status = "active"; 
				d3.select("label."+current_post_status).attr("class", "inactive");
				current_post_status = "inactive";
				time_bin_index=pre_time_bin_index;
				restart_active_animation();
			}
		});
	d3.select("div#btn-container")
		.append("label")
		.attr("class", current_post_status)
		.append("input")
		.attr("name", "toggle")
		.attr("type", "radio")
		.attr("id", "post")
		.on('change', function(){
			if (current_post_status=="inactive"){
				d3.select("label."+current_pre_status).attr("class", "inactive");
				current_pre_status = "inactive"; 
				d3.select("label."+current_post_status).attr("class", "active");
				current_post_status = "active";
				time_bin_index=post_time_bin_index;
				restart_active_animation();
			}
		});;
	if (current_post_status=="active"){
		d3.select("input#post").property("checked", "checked");
	} else {
		d3.select("input#pre").property("checked", "checked");
	}
	d3.select("label."+current_pre_status)
		.append("span")
		.text("Pre-Stimulus");
	d3.select("label."+current_post_status)
		.append("span")
		.text("Post-Stimulus");
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
	d3.select("div#btn-container").selectAll("*").remove();
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
	} else if (type=="full"){
		xAxis.tickFormat(n=>(n-500));
		var transform = "translate(0,0)",
		y_displacement = 30;
	} else if (type=="hist"){
		let front_x_displacement = xScale.invert(w/31);
		xAxis.tickFormat(n=>round(n-front_x_displacement))
			.tickValues(range(xScale.domain()[1]-front_x_displacement+10, 10).map(n=>n+front_x_displacement));
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
	} else if (type=="continuous"){
		xAxis.tickFormat(n=>(n-500));
		var transform = "translate(0,0)",
		y_displacement = 30;
	} else if (type=="hist"){
		let front_x_displacement = xScale.invert(w/31),
			values = range(xScale.domain()[1]-front_x_displacement, 10).map(n=>n+front_x_displacement);
		xAxis.tickFormat(n=> round(n-front_x_displacement))
			.tickValues(values);
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

function draw_y_axis(y_label="Average Firing Rate (mHz)", type="continuous", format_func=null){
	yAxis = d3.axisLeft(yScale);
	// y-axis
	var tick_values = null;
	// y-axis
	if (type=="boolean"){
		format_func = d3.format(".1")
		tick_values = [0,1];
	}
	yAxis.tickValues(tick_values)
		.tickFormat(format_func);
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

function transition_y_axis(y_label="Average Firing Rate (mHz)", type="continuous", delay=0, duration=1000, format_func = null) {
	yAxis = d3.axisLeft(yScale);
	var tick_values = null;
	// y-axis
	if (type=="boolean"){
		format_func = d3.format(".1")
		tick_values = [0,1];
	}
	yAxis.tickValues(tick_values)
		.tickFormat(format_func);
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
	let current_section =get_active_section();
	if ((current_section==bin_average)||(current_section==show_stimuli)||(current_section==single_neuron_spike_train)){
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
	}});
}
function single_neuron_spike_train(){
	// draws a single neuron spike train with axes
	remove_all();
	svg.select("#brain").transition().duration(0).attr("height",0);
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

function transition_average_firing_rate(data=null, data_length=null, selection=graph.select("g.bins").selectAll("rect"), line_width = 2, opacity=1){
	if (data != null){
		selection.data(data);
	} else {
		data = selection.data();
	}
	if (data_length == null){
		data_length = x_domain[bin]().length;
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
	if (get_active_section()==bin_average){
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
	}});
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

function shuffle (array) {
	var i = 0
		, j = 0
		, temp = null;

	for (i = array.length - 1; i > 0; i -= 1) {
		j = Math.floor(Math.random() * (i + 1));
		temp = array[i];
		array[i] = array[j];
		array[j] = temp;
	}
	return array
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
	return graph.selectAll("polygon.ci")
		.data(get_polygon_data(ci_list))
		.enter()
		.append("polygon")
		.attr("class", "ci")
		.attr("points",function(p) {
			return p.map(function(d) {
				return [d.x,yScale(d.y)].join(",");
			}).join(" ");
		}).attr("fill", d=>d[0].c)
		.attr("opacity", opacity);
}

function transition_confidence_intervals(selection = null, opacity=0.25, duration=1000){
	selection = (selection ==null) ? graph.selectAll("polygon"): selection;
	return selection.transition()
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
	time_ran = performance.now();
	single_neuron_color_data.then(function(data_full){
	if (get_active_section()==trial_average){
		draw_stimuli("all");
		xScale = bandScale;
		xScale.domain(x_domain[bin]());	
		[data, color_data, average_color_data_list, ci_data] = data_full;
		let data_length = average_color_data_list[0].length;
		average_color_data = flatten(d3ify_avg_color_data(average_color_data_list));
		color_data = flatten(color_data);
		draw_y_axis("Average Firing Rate (mHz)", "continuous");
		draw_x_axis("Time bins before/after stimulus is shown (ms)", "bins", data[bin+"_extents"]);
		// draw current stimulus line 
		let original_data = color_data.slice(stimuli_display_number*data_length*2,
			(stimuli_display_number+1)*data_length*2);
		var selection;
		// rescale to max
		var interval = 50, n_repeats = 100, delay = 2000;
		setTimeout(draw_original_data(time_ran), 0);
		function draw_original_data(t){return function(){
			if ((get_active_section()==trial_average)&&(t==time_ran)){
				selection = draw_average_firing_rate(original_data, data_length);
				transition_average_firing_rate(original_data, data_length, selection, line_width=1).delay(1000);
		}}}

		setTimeout(scale_to_full(time_ran), 500);
		function scale_to_full(t){return function(){
			if ((get_active_section()==trial_average)&&(t==time_ran)){
				yScale.domain(y_domain[bin+"_full"]);
		}}}
		setTimeout(transition_to_full(time_ran), 505);
		function transition_to_full(t){return function(){
			if ((get_active_section()==trial_average)&&(t==time_ran)){

				transition_y_axis("Average Firing Rate (mHz)", "continuous", delay=250);
				transition_average_firing_rate(original_data, data_length, selection, line_width=1).delay(250);
		}}}
		setTimeout(draw_random_samples(time_ran), 1510);
		function draw_random_samples(time){return function(){
			if ((get_active_section()==trial_average)&&(time==time_ran)){
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
		}}}

		setTimeout(make_cis(time_ran), 1560+interval*n_repeats+delay);
		function make_cis(t){return function(){
			if ((get_active_section()==trial_average)&&(t==time_ran)){
				graph.select("g.bins").attr("class", "remove");
				draw_confidence_intervals(ci_data, 1e-6);
				setTimeout(function(){
					graph.selectAll("polygon")
					.transition()
					.duration(1000)
					.attr("opacity",0.25);
				}, 1);
		}}}
		setTimeout(draw_averages(time_ran), 1565+interval*n_repeats+delay);
		function draw_averages(t){return function(){
			if ((get_active_section()==trial_average)&&(t==time_ran)){
				draw_average_firing_rate(average_color_data, data_length,2,1e-6)
				.transition()
				.duration(1000)
				.attr("opacity",1.0);
				d3.select("g.remove").transition().delay(2000).duration(1000).attr("opacity", 1e-6).remove();
		}}}
		setTimeout(rescale_domain(time_ran), 1810+interval*n_repeats+delay);
		function rescale_domain(t){return function(){
			if ((get_active_section()==trial_average)&&(t==time_ran)){
				yScale.domain([0,d3.max(flatten(flatten(ci_data)))]);
		}}}

		setTimeout(transition_averages(time_ran), 2570+interval*n_repeats+delay);
		function transition_averages(t){return function(){
			if ((get_active_section()==trial_average)&&(t==time_ran)){
				transition_confidence_intervals();
				transition_average_firing_rate(average_color_data, data_length,selection=graph.select("g.bins").selectAll("rect"),2)
					.duration(1000)
				transition_y_axis();
		}}}
		
	}});
}
function change_prop_index(event_x){
	prop_index = event_x*10-1;
	restart_active_animation();
}

function draw_slider(label_text = "Percent of data used", values = range(10).map(d=>round(d/10+0.1, 1)), end_function=change_prop_index, format_func = function(d) { return (d*10+10)+"%";}){
	let slider_margin = {left: 15, right: 15},
	width = $("#btn-container").width()-slider_margin.left-slider_margin.right,
	height = 40;
	var x = d3.scaleQuantize()
	.domain([0, width])
	.range(range(values.length));
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
			handle.attr("cx", width/values.length*x(d3.event.x)+(width/values.length)/2); 
			curr_val_index = x(d3.event.x);
	})
		.on("end", function() {
			handle.attr("cx", width/values.length*x(d3.event.x)+(width/values.length)/2);
			curr_val_index = x(d3.event.x);
			end_function(values[x(d3.event.x)]);
		}));
	slider.insert("g", ".track-overlay")
	.attr("class", "ticks")
	.attr("transform", "translate(0," + 18 + ")")
	.selectAll("text")
	.data(x.range())
	.enter().append("text")
	.attr("x",(d,i)=>width/values.length*i+(width/values.length)/2)
	.attr("text-anchor",function(d){
		return "middle"})
	.text(d=>format_func(values[d]));

	var handle = slider.insert("circle", ".track-overlay")
	.attr("class", "handle")
	.attr("r", 9)
	.attr("cx", width/values.length*curr_val_index+(width/values.length)/2);
	$("#btn-text").text(label_text)
}

function remove_slider(){
	$(".slider_svg").remove();
}

function confidence_intervals(){
	remove_all();
	draw_slider();
	time_ran = performance.now();
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
	time_ran = performance.now();
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

function draw_label_with_bounding_box(label, font_size, x, y, selection=graph.select("g.label"), class_name=label, scale=true){
	if (scale){
		x=xScale(x);
		y=yScale(y);
	}
	rect = selection.append("rect").attr("class", class_name);
	text = selection.append("text").attr("class", class_name).text(label).attr("x", x).attr("y", y).attr("text-anchor","middle").attr("font-size",font_size);		
	a = text.nodes()[0].getBBox();
	a.width = a.width*1.5;
	a.x = x-0.5*a.width;
	a.y = y-0.75*a.height;
	rect.attr("x", a.x).attr("y", a.y).attr("width", a.width).attr("height", a.height).attr("fill", "#ffffff");
	return selection.selectAll("."+class_name)
}

function remove_label_with_bounding_box(which, duration = 0){
	graph.select("g.label").selectAll("."+which).transition().duration(duration).attr("opacity",1e-6).on("end", function(){
		graph.select("g.label").selectAll("."+which).remove();
	});
}

function transition_labels_with_bounding_box(data, duration=0,selection=graph.select("g.label")){
	let t = d3.transition().duration(duration);
	text = selection.selectAll("text").data(data).transition(t).attr("x", d=>xScale(d.x)).attr("y",d=>yScale(d.y)).attr("text-anchor","middle").selection();
	rect_data = text.nodes()
		.map(label=>label.getBBox())
		.map(function(bbox,i){
			bbox.width = bbox.width*1.5;
			bbox.x = xScale(data[i].x)-0.5*bbox.width;
			bbox.y = yScale(data[i].y)-0.75*bbox.height;
			return bbox;
		});
	selection.selectAll("rect")
		.data(rect_data)
		.transition(t)
		.attr("x", d=>d.x)
		.attr("y", d=>d.y)
		.attr("width", d=>d.width)
		.attr("height", d=>d.height);
}
function neuron_magnitude_comparison(){
	remove_all();
	time_ran = performance.now();
	full_data.then(function(data){
		draw_stimuli("all");
		[a_average_color_data, a_confidence_intervals] = data[neuron_a_number];
		[b_average_color_data, b_confidence_intervals] = data[neuron_b_number];
		yScale.domain([0,d3.max(flatten(flatten(a_confidence_intervals)))]);
		xScale = bandScale;
		xScale.domain(x_domain[bin]());
		let data_length = a_average_color_data[0].length,
			text_size = 32,
			label_g, a,b,a_text,b_text,b_rect,a_rect;

		a_mid_end = d3.mean(flatten(flatten(a_average_color_data)));
		b_mid_end = d3.mean(flatten(flatten(b_average_color_data)));
		a_average_color_data = flatten(d3ify_avg_color_data(a_average_color_data));
		b_average_color_data = flatten(d3ify_avg_color_data(b_average_color_data));
		draw_confidence_intervals(a_confidence_intervals);
		graph.selectAll("polygon.ci").attr("class", "a-ci");
		draw_confidence_intervals(b_confidence_intervals, 1e-6);
		setTimeout(draw_a(time_ran), 2);
		function draw_a(t){return function(){
			if ((t==time_ran)&&(get_active_section()==neuron_magnitude_comparison)){
				draw_average_firing_rate(a_average_color_data, data_length,2, 1);
				graph.selectAll("g.bins").attr("class", "a-bins");
				draw_average_firing_rate(b_average_color_data, data_length,2, 1e-6);
				label_g = graph.append("g").attr("class", "label").attr("opacity", 1e-6);
				draw_label_with_bounding_box("A", text_size, data_length-1,a_mid_end, label_g );
		}}}
		
		setTimeout(draw_b(time_ran), 1000);
		function draw_b(t){return function(){
			if ((t==time_ran)&&(get_active_section()==neuron_magnitude_comparison)){
				transition_confidence_intervals()
				setTimeout( function(){
					transition_average_firing_rate(b_average_color_data, data_length,
						selection=graph.select("g.bins").selectAll("rect"),2, 0.9).duration(1000);
					draw_label_with_bounding_box("B", text_size, data_length-1,b_mid_end, label_g);
					label_g.transition().attr("opacity",1).duration(1000);
				}, 2);
		}}}

		binned_data.then((data)=> draw_x_axis("Time bins before/after stimulus is shown (ms)", "bins", data[bin+"_extents"]));
		draw_y_axis("Average Firing Rate (mHz)", "continous");
	})

	return;
}


function draw_mean(which, data, data_length=x_domain[bin]().length, selection=graph.select("g.mean")){
	return selection.selectAll("rect")
		.data(data)
		.enter()
		.append("rect")
		.attr("class", which)
		.attr("x",xScale(0))
		.attr("y",d=>yScale(d.m))
		.attr("height",2)
		.attr("width",xScale(data_length-1)+xScale.bandwidth());
}

function transition_mean(which, data, data_length=x_domain[bin]().length, selection=graph.select("g.mean")){
	selection = selection.selectAll("rect."+which);
	return selection.data(data)
		.transition()
		.attr("x",xScale(0))
		.attr("y",d=>yScale(d.m))
		.attr("height",2)
		.attr("width",xScale(data_length-1)+xScale.bandwidth());
}
function draw_sd(which, data, data_length=x_domain[bin]().length, selection=graph.select("g.sd")){
	return selection.selectAll("rect")
		.data(data)
		.enter()
		.append("rect")
		.attr("class", which)
		.attr("width", 2)
		.attr("x", xScale(round(data_length/2)))
		.attr("height", d=>yScale(d.m)-yScale(d.sd))
		.attr("y", d=>yScale(d.sd));
}

function transition_sd(which, data, selection=graph.select("g.sd")){
	selection = selection.selectAll("rect."+which);
	return selection.data(data)
		.transition()
		.attr("height", d=>yScale(0)-yScale(d.sd))
		.attr("y", d=>yScale(d.sd));
}

function normalize_single_neuron(t, name,d3_data, sub_mean_avg, sub_mean_cis, norm_avg, norm_cis, domain_map,polygon_selection,firing_rate_selection, data_length = x_domain[bin]().length){
	var name_map = {"A":0,"B": 1},
		domain = domain_map[name];
	//draw mean
	setTimeout(mean_appear(time_ran));
	function mean_appear(t) {return function() {
		if ((t==time_ran) && (get_active_section()==neuron_normalization)){
			draw_mean(name, [d3_data[name_map[name]]])
				.attr("opacity",1e-6)
				.transition()
				.duration(1000)
				.attr("opacity",1);
	}};}

	// transition to sub mean data
	setTimeout(domain_to_sub_mean(time_ran), 1050)
	function domain_to_sub_mean(t) {return function() {
		if ((t==time_ran) && (get_active_section()==neuron_normalization)){
			yScale.domain(domain.map(d=>d-d3_data[name_map[name]].m));
	}};}

	setTimeout(scale_to_sub_mean(time_ran), 1100);
	function scale_to_sub_mean(t) {return function() {
		if ((t==time_ran) && (get_active_section()==neuron_normalization)){
			polygon_selection.data(get_polygon_data(sub_mean_cis));
			transition_confidence_intervals(polygon_selection);
			transition_average_firing_rate(sub_mean_avg,data_length, firing_rate_selection).duration(1000);
			transition_y_axis("Difference From Mean Average Firing Rate (mHz)");
			transition_labels_with_bounding_box([{x:data_length-1, y:0}], 1000);
			transition_mean(name, [{m:0, sd:d3_data[name_map[name]].sd}]).duration(1000);
	}};}
	// draw sd
	setTimeout(sd_appear(time_ran),3000)
	function sd_appear(t) {return function() {
		if ((t==time_ran) && (get_active_section()==neuron_normalization)){
			draw_sd(name, [{m:0, sd:d3_data[name_map[name]].sd}])
			.attr("opacity",1e-6)
			.transition()
			.duration(1000)
			.attr("opacity",1);
	}};}
	//transition to sd normalized data
	setTimeout(domain_to_norm(time_ran), 4010);
	function domain_to_norm(t) {return function() {
		if ((t==time_ran) && (get_active_section()==neuron_normalization)){

			yScale.domain(domain.map(d=>(d-d3_data[name_map[name]].m)/d3_data[name_map[name]].sd));
	}};}
	setTimeout(scale_to_norm(time_ran), 5050);
	function scale_to_norm(t) {return function() {
		if ((t==time_ran) && (get_active_section()==neuron_normalization)){
			polygon_selection.data(get_polygon_data(norm_cis));
			transition_y_axis("Standard Deviations Away From Mean Firing Rate");
			transition_average_firing_rate(norm_avg,data_length, firing_rate_selection).duration(1000);
			transition_labels_with_bounding_box([{x:data_length-1, y:0}], 1000);
			transition_confidence_intervals(polygon_selection).duration(1000);
			transition_mean(name, [{m:0, sd:1}]).duration(1000);
			transition_sd(name, [{m:0, sd:1}]).duration(1000);
	}};}
	setTimeout(remove_mean_and_sd(time_ran), 6050);
	function remove_mean_and_sd(t) {return function() {
		if ((t==time_ran) && (get_active_section()==neuron_normalization)){
			graph.select("g.sd").selectAll("rect."+name).transition().duration(1000).attr("opacity",1e-6).on("end",function(){
				graph.select("g.sd").selectAll("rect."+name).remove()
			});
			graph.select("g.mean").selectAll("rect."+name).transition().duration(1000).attr("opacity",1e-6).on("end",function(){
				graph.select("g.mean").selectAll("rect."+name).remove();
			});
	}};}
}

function label_graph(text, font_size){
	var label = graph.select("g.annotate").select("text");
	if (label.nodes().length==0){
		graph.append("g").attr("class","annotate");
		label = graph.select("g.annotate").append("text");
	} else {
		label.transition().attr("y", -h/2);
	}
	label.text(text).attr("font-size", font_size).attr("x", w/2).attr("text-anchor","middle").attr("y",-15).attr("opacity",1e-6)
	.transition().attr("opacity" , 1);

}

var time_ran = performance.now();

function neuron_normalization(){
	remove_all();
	time_ran = performance.now();
	full_data.then(function(full_data){
		draw_stimuli("all");
		[a_average_color_data, a_confidence_intervals] = full_data[neuron_a_number];
		[b_average_color_data, b_confidence_intervals] = full_data[neuron_b_number];
		yScale.domain([0,d3.max(flatten(flatten(a_confidence_intervals)))]);
		xScale = bandScale;
		xScale.domain(x_domain[bin]());
		var data_length = a_average_color_data[0].length,
			text_size = 32,
			label_g,
			a_sub_data = a_average_color_data.map(color=>color.map(d=>d-a_mean)),
			b_sub_data = b_average_color_data.map(color=>color.map(d=>d-b_mean)),
			a_sub_mean_color_data = flatten(d3ify_avg_color_data(a_sub_data)),
			b_sub_mean_color_data = flatten(d3ify_avg_color_data(b_sub_data)),
			a_sub_mean_cis = a_confidence_intervals.map(color=>color.map(time_bin=>time_bin.map(d=>d-a_mean))),
			b_sub_mean_cis = b_confidence_intervals.map(color=>color.map(time_bin=>time_bin.map(d=>d-b_mean))),
			d3_data = [{m: a_mean, sd: a_sd},{m: b_mean, sd: b_sd}],
			mean_g, sd_g;
		a_average_color_data = flatten(d3ify_avg_color_data(a_average_color_data));
		b_average_color_data = flatten(d3ify_avg_color_data(b_average_color_data));
		draw_confidence_intervals(a_confidence_intervals);
		graph.selectAll("polygon.ci").attr("class", "a-ci");
		draw_confidence_intervals(b_confidence_intervals);
		setTimeout( function(){
			draw_average_firing_rate(a_average_color_data, data_length,2, 1);
			graph.selectAll("g.bins").attr("class", "a-bins");
			draw_average_firing_rate(b_average_color_data, data_length,2, 1);
			mean_g = graph.append("g").attr("class", "mean");
			sd_g = graph.append("g").attr("class", "sd");
			label_g = graph.append("g").attr("class", "label");
			draw_label_with_bounding_box("A", text_size, data_length-1, a_mean, label_g);
			draw_label_with_bounding_box("B", text_size, data_length-1, b_mean, label_g);
		});
		
		binned_data.then((data)=> draw_x_axis("Time bins before/after stimulus is shown (ms)", "bins", data[bin+"_extents"]));
		draw_y_axis("Average Firing Rate (mHz)", "continous");
		norm_full_data.then(function(data){
			[a_norm_color_data, a_norm_cis] = data[neuron_a_number];
			[b_norm_color_data, b_norm_cis] = data[neuron_b_number];
			var full_sub_data = flatten(flatten(a_sub_mean_cis.concat(b_sub_mean_cis))),
				full_norm_data = flatten(flatten(a_norm_cis.concat(b_norm_cis))), 
				domain_map = {"A": [d3.min(flatten(flatten(a_confidence_intervals))),d3.max(flatten(flatten(a_confidence_intervals)))],
								"B": [d3.min(flatten(flatten(b_confidence_intervals))),d3.max(flatten(flatten(b_confidence_intervals)))]};
			a_norm_color_data = flatten(d3ify_avg_color_data(a_norm_color_data));
			b_norm_color_data = flatten(d3ify_avg_color_data(b_norm_color_data));
			// fade out b
			setTimeout(fade_out_b(time_ran), 1000);
			function fade_out_b(t) {return function() {
				if ((t==time_ran) && (get_active_section()==neuron_normalization)){
					transition_average_firing_rate(null,null, graph.select("g.bins").selectAll("rect"),2,1e-6).duration(1000);
					graph.selectAll("polygon.ci").transition().attr("opacity", 1e-6).duration(1000);
					remove_label_with_bounding_box("B", 1000);
			}};}
			//transition domain to focus a
			setTimeout(scale_to_a(time_ran), 2000);
			function scale_to_a(t) {return function() {
				if ((t==time_ran) && (get_active_section()==neuron_normalization)){
					yScale.domain(domain_map["A"]);
			}};}
			//transition a to natural domain
			setTimeout(transition_a(time_ran), 2005);
			function transition_a(t) {return function() {
				if ((t==time_ran) && (get_active_section()==neuron_normalization)){
					transition_labels_with_bounding_box([{x:data_length-1, y:a_mean}], 1000);
					transition_average_firing_rate(null,null, graph.select("g.a-bins").selectAll("rect"),2,1).duration(1000);
					transition_confidence_intervals(graph.selectAll("polygon.a-ci"));
					transition_y_axis();
			}};}

			//normalize a
			setTimeout(normalize_a(time_ran), 3500);
			function normalize_a(t) {return function() {
				if ((t==time_ran) && (get_active_section()==neuron_normalization)){
					normalize_single_neuron(t, "A",d3_data, a_sub_mean_color_data, a_sub_mean_cis, a_norm_color_data, a_norm_cis,
					domain_map, graph.selectAll("polygon.a-ci"),graph.select("g.a-bins").selectAll("rect"));
			}};}
			//remove a
			setTimeout(fade_out_a(time_ran), 10000);
			function fade_out_a(t) {return function() {
				if ((t==time_ran) && (get_active_section()==neuron_normalization)){
					remove_label_with_bounding_box("A", 1000);
					transition_average_firing_rate(null,null, graph.select("g.a-bins").selectAll("rect"),2,1e-6).duration(1000);
					graph.selectAll("polygon.a-ci").transition().attr("opacity", 1e-6).duration(1000);
			}};}
			//transition domain to focus b
			setTimeout(scale_to_b(time_ran), 11010);
			function scale_to_b(t) {return function() {
				if ((t==time_ran) && (get_active_section()==neuron_normalization)){
					yScale.domain(domain_map["B"]);
			}};}

			//transition b to natural domain
			setTimeout(transition_b(time_ran), 11500);
			function transition_b(t) {return function() {
				if ((t==time_ran) && (get_active_section()==neuron_normalization)){
					draw_label_with_bounding_box("B", text_size, data_length-1, b_mean, label_g).attr("opacity", 1e-6)
					.transition().attr("opacity", 1).duration(1000);
					transition_average_firing_rate(null,null, graph.select("g.bins").selectAll("rect"),2,1).duration(1000);
					transition_confidence_intervals(graph.selectAll("polygon.ci"));
					transition_y_axis();
			}};}
			// normalize b
			setTimeout(normalize_b(time_ran), 13500);
			function normalize_b(t) {return function() {
				if ((t==time_ran) && (get_active_section()==neuron_normalization)){
					 	normalize_single_neuron(t, "B",d3_data, b_sub_mean_color_data, b_sub_mean_cis, b_norm_color_data, b_norm_cis,
					domain_map, graph.selectAll("polygon.ci"), graph.select("g.bins").selectAll("rect"));
			}};}

		});
	});
	return;
}
function neuron_information_comparison(){
	remove_all();
	norm_full_data.then(function(data){
	if (get_active_section()==neuron_information_comparison){
		[b_norm_color_data, b_cis] = data[neuron_b_number];
		var data_length = b_norm_color_data[0].length,
			text_size = 32,
			label_g;
		xScale = bandScale;
		xScale.domain(x_domain[bin]());
		yScale.domain([d3.min(flatten(flatten(b_cis))),d3.max(flatten(flatten(b_cis)))]);

		draw_stimuli("all");
		binned_data.then((data)=> draw_x_axis("Time bins before/after stimulus is shown (ms)", "bins", data[bin+"_extents"]));
		draw_y_axis("Standard Deviations Away From Mean Firing Rate", "continous");

		b_norm_color_data = flatten(d3ify_avg_color_data(b_norm_color_data));
		draw_confidence_intervals(b_cis);
		setTimeout( function(){
			draw_average_firing_rate(b_norm_color_data, data_length,2, 1);
			label_g = graph.append("g").attr("class", "label");
			draw_label_with_bounding_box("B", text_size, data_length-1, 0, label_g);
		});
	}});
	return;
}
function neuron_average(){
	remove_all();
	time_ran = performance.now();
	norm_full_data.then(function(data){
	if (get_active_section()==neuron_average){
		[a_norm_color_data, a_cis] = data[neuron_a_number];
		[b_norm_color_data, b_cis] = data[neuron_b_number];
		average = a_norm_color_data.map((color,c_ind)=>color.map((d,i)=>(d+b_norm_color_data[c_ind][i])/2));
		average_cis = a_cis.map((color,c_ind)=>color.map((time_bin, t_ind)=>time_bin.map((d,i)=>(d+b_cis[c_ind][t_ind][i])/2)));
		var data_length = a_norm_color_data[0].length,
			text_size = 32,
			label_g,
			first_domain = [d3.min(flatten(flatten(b_cis))),d3.max(flatten(flatten(b_cis)))],
			domain = [d3.min(flatten(flatten(a_cis.concat(b_cis)))),d3.max(flatten(flatten(a_cis.concat(b_cis))))];
		xScale = bandScale;
		xScale.domain(x_domain[bin]());
		yScale.domain(first_domain);

		draw_stimuli("all");
		binned_data.then((data)=> draw_x_axis("Time bins before/after stimulus is shown (ms)", "bins", data[bin+"_extents"]));
		draw_y_axis("Standard Deviations Away From Mean Firing Rate", "continous");

		a_norm_color_data = flatten(d3ify_avg_color_data(a_norm_color_data));
		b_norm_color_data = flatten(d3ify_avg_color_data(b_norm_color_data));
		average_color_data = flatten(d3ify_avg_color_data(average));
		
		
		draw_confidence_intervals(b_cis);
		graph.selectAll("polygon.ci").attr("class", "b-ci");
		graph.selectAll("polygon.ci").enter().append("polygon").attr("class","ci");
		setTimeout( function(){
			draw_average_firing_rate(b_norm_color_data, data_length,2, 1);
			graph.selectAll("g.bins").attr("class", "b-bins");
			graph.append("g").attr("class", "bins");
			label_g = graph.append("g").attr("class", "label");
			draw_label_with_bounding_box("B", text_size, data_length-1, 0, label_g);
		});
		setTimeout(transition_full_domain(time_ran),10);
		function transition_full_domain(t){return function(){
			if ((get_active_section()==neuron_average)&&(t==time_ran)){
				yScale.domain(domain);
				setTimeout(function(){
					draw_confidence_intervals(a_cis, 1e-6);
					transition_average_firing_rate(null,null, graph.select("g.b-bins").selectAll("rect"),2,1).duration(1000);
					transition_confidence_intervals(graph.selectAll("polygon.b-ci")).duration(1000);
					transition_labels_with_bounding_box([{x: data_length-1, y: 0}], 1000);
					transition_y_axis("Standard Deviations Away From Mean Firing Rate");
					draw_average_firing_rate(a_norm_color_data, data_length,2, 1e-6);
					draw_label_with_bounding_box("A", text_size,	data_length-1, 0, label_g).attr("opacity", 1e-6);
				});
			}
		}};
		setTimeout(a_appear_b_dissappear(time_ran),3000);
		function a_appear_b_dissappear(t){return function(){
			if ((get_active_section()==neuron_average)&&(t==time_ran)){
				graph.selectAll("g.b-bins").selectAll("rect").transition().duration(1000).attr("opacity",1e-6);
				graph.selectAll("polygon.b-ci").transition().duration(1000).attr("opacity",1e-6);
				graph.selectAll(".B").transition().duration(1000).attr("opacity",1e-6);
				graph.selectAll("g.bins").selectAll("rect").transition().duration(1000).attr("opacity",1);
				graph.selectAll("polygon.ci").transition().duration(1000).attr("opacity",0.25);
				graph.selectAll(".A").transition().duration(1000).attr("opacity",1);
				draw_label_with_bounding_box("Mean", 28, data_length-4, 0, label_g, "Mean").attr("opacity", 1e-6);
			}
		}};
		setTimeout(avg_appear_a_dissapear(time_ran),6000);
		function avg_appear_a_dissapear(t){return function(){
			if ((get_active_section()==neuron_average)&&(t==time_ran)){
				transition_average_firing_rate(average_color_data,null, graph.select("g.b-bins").selectAll("rect"),2,1).duration(1000);
				graph.selectAll("polygon.b-ci").data(get_polygon_data(average_cis));
				transition_confidence_intervals(graph.selectAll("polygon.b-ci"));
				graph.selectAll(".Mean").transition().duration(1000).attr("opacity",1);
				graph.selectAll(".B").transition().duration(1000).attr("opacity",1e-6);
				graph.selectAll("g.bins").selectAll("rect").transition().duration(1000).attr("opacity",1e-6);
				graph.selectAll("polygon.ci").transition().duration(1000).attr("opacity",1e-6);
				graph.selectAll(".A").transition().duration(1000).attr("opacity",1e-6);	
			}
		}};
	}});
	return;
}

function compared_neuron_separation(){
	remove_all();
	time_ran = performance.now();
	norm_full_data.then(function(data){
	if (get_active_section()==compared_neuron_separation){
		[a_norm_color_data, a_cis] = data[neuron_a_number];
		[b_norm_color_data, b_cis] = data[neuron_b_number];
		average = a_norm_color_data.map((color,c_ind)=>color.map((d,i)=>(d+b_norm_color_data[c_ind][i])/2));
		average_cis = a_cis.map((color,c_ind)=>color.map((time_bin, t_ind)=>time_bin.map((d,i)=>(d+b_cis[c_ind][t_ind][i])/2)));
		var data_length = a_norm_color_data[0].length,
			text_size = 32,
			label_g,
			domain = [d3.min(flatten(flatten(a_cis.concat(b_cis)))),d3.max(flatten(flatten(a_cis.concat(b_cis))))];
		xScale = bandScale;
		xScale.domain(x_domain[bin]());
		yScale.domain(domain);

		draw_stimuli("all");
		binned_data.then((data)=> draw_x_axis("Time bins before/after stimulus is shown (ms)", "bins", data[bin+"_extents"]));
		draw_y_axis("Standard Deviations Away From Mean Firing Rate", "continous");

		a_norm_color_data = flatten(d3ify_avg_color_data(a_norm_color_data));
		average_color_data = flatten(d3ify_avg_color_data(average));
		
		draw_confidence_intervals(average_cis);
		setTimeout( function(){
			draw_average_firing_rate(average_color_data, data_length,2, 1);
			label_g = graph.append("g").attr("class", "label");
			draw_label_with_bounding_box("Mean", 28, data_length-7, 0, label_g, "Mean");
			draw_label_with_bounding_box("A", text_size,	data_length-1, 0, label_g).attr("opacity", 1e-6)
		});
		setTimeout(mean_dissappear_a_appear(time_ran),2000);
		function mean_dissappear_a_appear(t){return function(){
			if ((get_active_section()==compared_neuron_separation)&&(t==time_ran)){
				graph.selectAll(".Mean").transition().duration(1000).attr("opacity",1e-6);
				transition_average_firing_rate(a_norm_color_data,null, graph.select("g.bins").selectAll("rect"),2,1).duration(1000);
				graph.selectAll("polygon").data(get_polygon_data(a_cis));
				transition_confidence_intervals().duration(1000);
				graph.selectAll(".A").transition().duration(1000).attr("opacity", 1);
			}
		}};
	}});
	return;
}
function return_counts(accumulator, current){
	if (current.c in accumulator){
		accumulator[current.c] += 1;
	} else {
		accumulator[current.c] = 1;
	}
	return accumulator;
}


function draw_multi_hist(starts, ends){
	ticks = starts.map((start, i)=>(start, round((start[i]+ends[i])/2)), ends[i]);
	graph.selectAll('.x.label')
		.transition()
		.delay(delay)
		.attr("y", y_displacement)
		.text(x_label);
	graph.selectAll('.x.label')
		.transition()
		.delay(delay)
		.attr("y", 30)
		.text(x_label);
	return(graph.select('.x')
	.transition()
	.delay(delay)
	.call(xAxis)
	.selection()
	.selectAll("text:not(.label)")
	.attr("transform", "translate(0,0)"));
}

function transition_multi_hist_axis(starts, ends, front_x_displacement = null, duration=1000){
	front_x_displacement = (typeof front_x_displacement== "undefined")? xScale.invert(w/30): front_x_displacement;
	var values= flatten(starts.map((start,i)=>[xScale.invert(start+front_x_displacement), xScale.invert((start+ends[i])/2+front_x_displacement)]));

	xAxis = d3.axisBottom(xScale);
	// x-axis
	
	xAxis.tickFormat(function(n,i){
		let to_return = (i%2==0)? 0:values[i]-values[i-1];
		return round(to_return)})
		.tickValues(values);
	var transform = "translate(0,0)",
		y_displacement = 45;
	if (graph.selectAll('.x.label').text()!="Number of Trials"){
		graph.selectAll('.x.label')
			.transition()
			.delay(0)
			.attr("y", y_displacement)
			.text("Number of Trials")
			.attr("font-size", 14);
	} else {
		graph.selectAll('.x.label')
			.attr("y", y_displacement)
			.text("Number of Trials")
			.attr("font-size", 14);
	}
	var text_data = ["means"].concat(ind_to_label_map).map(function(t,i){
		let x = (i==0)? front_x_displacement/2: (ends[i-1]+starts[i-1])/2+front_x_displacement;
		return {t:t, x:x}
	});
	if (graph.select("g.stimuli_labels").nodes().length==0){
		graph.append("g").attr("class", "stimuli_labels");
	}
	graph.select("g.stimuli_labels").selectAll("text").data(text_data).enter().append("text")
	.attr("x",d=>d.x).attr("y",h+30).attr("text-anchor","middle").text(d=>d.t).attr("font-size",12);

	graph.select('.x')
		.transition()
		.duration(duration)
		.call(xAxis)
		.selection()
		.selectAll("text:not(.label)")
		.attr("transform", transform);
	setTimeout(function(){
		graph.select("g.x.axis").transition();
		let str=graph.select("g.x.axis").select('path.domain').attr("d");
		graph.select("g.x.axis").select('path.domain').attr("d", str.replace(/H[0-9.]*V/, "H"+w+"V"));
		let x_ticks = graph.select("g.x.axis").selectAll('g.tick').nodes();
		for (var i=0; i< x_ticks.length; i++){
			if (i%2==0){
				d3.select(x_ticks[i]).select("line").attr("stroke-dasharray", "5, 5").attr("y1", -h).attr("stroke-fill", "#e4e4e4");
			}
		}
	}, duration+10);
	
}

function time_bin_zoom_to_histogram(){
	remove_all();
	time_ran = performance.now();
	norm_full_data.then(function(data){
	single_neuron_color_data.then(function(a_data){
	if (get_active_section()==time_bin_zoom_to_histogram){
		var color_data= a_data[1];
		[a_norm_color_data, a_cis] = data[neuron_a_number];
		[b_norm_color_data, b_cis] = data[neuron_b_number];
		
		norm_color_data = JSON.parse(JSON.stringify(color_data)).map(function(trial){
			trial[time_bin_index].d = ((trial[time_bin_index].d-a_mean)/a_sd);
			return trial[time_bin_index];
		});
		var data_length = a_norm_color_data[0].length,
			text_size = 32,
			label_g,
			x_between_offset = w/(data_length*2),
			x_front_offset = w/data_length+2,
			domain = [d3.min(flatten(flatten(a_cis.concat(b_cis)))),d3.max(flatten(flatten(a_cis.concat(b_cis))))],
			d = norm_color_data.map(d=>d.d),
			full_domain = [d3.min(d), d3.max(d)],
			t_20_color_data = a_norm_color_data.map(color=>[color[time_bin_index]]), // list of length #stimuli
			t_20_cis = a_cis.map(color=>[color[time_bin_index]]), // list of [#stimuli, [low, high]],
			thresholds=15;
		var bins;
			
		xScale = bandScale;
		xScale.domain(x_domain[bin]());
		yScale.domain(domain);

		t_20_color_data=flatten(d3ify_avg_color_data(t_20_color_data).map(e=>e[0]));
		var t_20_color_data_original=JSON.parse(JSON.stringify(t_20_color_data)).map(function(d){d.i=time_bin_index; return d});
		console.log("full_domain",full_domain)
		console.log("norm_color_data",norm_color_data)


		draw_stimuli("all");
		draw_time_bin_buttons();
		binned_data.then((data)=> draw_x_axis("Time bins before/after stimulus is shown (ms)", "bins", data[bin+"_extents"]));
		draw_y_axis("Standard Deviations Away From Mean Firing Rate", "continous");

		var a_norm_color_data = flatten(d3ify_avg_color_data(a_norm_color_data));

		var moving_ci_data = t_20_cis.map(function(color,i){
			return {c: ind_to_color_map[i], x: time_bin_index, y:color[0][1], height: color[0][1]-color[0][0]}});
		graph.selectAll("rect.ci_slice").data(moving_ci_data).enter().append("rect").attr("class","ci_slice")
			.attr("x", d=>xScale(d.x)-1).attr("y",d=>yScale(d.y)).attr("height",d=>yScale(yScale.domain()[1]-d.height)).attr("width", xScale.bandwidth()+2)
			.attr("opacity", 1e-6).attr("fill", d=>d.c);
		console.log("moving_ci_data",moving_ci_data);
		draw_confidence_intervals(a_cis).attr("class", "full");
		setTimeout( function(){
			draw_average_firing_rate(a_norm_color_data, data_length,2, 1)
			graph.select("g.bins").attr("class", "full");
			draw_average_firing_rate(t_20_color_data_original, data_length,2, 1)
			graph.select("g.bins").attr("class", "slice");
			label_g = graph.append("g").attr("class", "label");
			draw_label_with_bounding_box("A", text_size,	data_length-1, 0, label_g);
		});
		var expanded_ci_data;
		
		setTimeout(draw_box_around_time_bin(time_ran),1000);
		function draw_box_around_time_bin(t){return function(){
			if ((get_active_section()==time_bin_zoom_to_histogram)&&(t==time_ran)){
				
				graph.append("rect")
					.attr("class","emphasis")
					.attr("x", xScale(time_bin_index))
					.attr("y", 0)
					.attr("height", yScale.range()[0])
					.attr("width", xScale.bandwidth()+2)
					.attr("fill", "none")
					.attr("stroke-width", 1)
					.attr("stroke", "#000000")
					.attr("opacity", 1e-6);

				graph.select("rect.emphasis")
					.transition()
					.duration(1000)
					.attr("opacity",1);
			}
		}};
		
		setTimeout(fade_out_full_data(time_ran),2000);
		function fade_out_full_data(t){return function(){
			if ((get_active_section()==time_bin_zoom_to_histogram)&&(t==time_ran)){
				graph.selectAll(".full").transition().duration(1000).attr("opacity", 1e-6).on("end", function(){
					graph.selectAll(".full").remove();
				});
				graph.selectAll(".A").transition().duration(1000).attr("opacity", 1e-6).on("end",function(){
					graph.selectAll(".A").remove()
				});
				graph.selectAll("rect.ci_slice").transition().duration(1000).attr("opacity", 0.25);

			}
		}};
		
		setTimeout(zoom_cis_to_fill_axis(time_ran), 4000)
		function zoom_cis_to_fill_axis(t){return function (){
			if ((get_active_section()==time_bin_zoom_to_histogram)&&(t==time_ran)){
				//remove x axis ticks
				graph.selectAll(".x.axis").selectAll(".tick").transition().attr("opacity", 1e-6).duration(1000);
				var t1,t2, text;
				binned_data.then(function(data){
					t1 = data[bin+"_extents"][time_bin_index][0]-500;
					t2 = data[bin+"_extents"][time_bin_index][1]-500;
					if ((t1>0)&&(t2>0)){
						text = "after"
					} else if ((t1<0)&&(t2<0)){
						text = "before"
						t1 *=-1;
						t2 *=-1
					}else {
						text="before/after"
					}
				
					graph.select(".x.label").transition().duration(1000)
						.text("Time bin "+t1+" to "+t2+"ms "+text+" stimulus is shown")
						.attr("y", 30);
				})
				//expand emphasis box
				graph.select("rect.emphasis").transition().duration(1000)
					.attr("x", 0)
					.attr("width", w)
					.transition().attr("opacity", 1e-6);
				//expand cis
				graph.selectAll(".ci_slice").transition().duration(1000).attr("x", 0).attr("width", w);
				//expand averages
				graph.select("g.slice").selectAll("rect").transition().duration(1000).attr("x", 1).attr("width", w-2);
				bins = d3.histogram()
					.value(function(d){return d.d})
					.domain(full_domain)
					.thresholds(thresholds)
					(norm_color_data);
				[color_bin_list, max_num, color_map_to_zero] = get_bin_list_max_num_color_map_to_zero(bins);
				[starting_x_vals, ending_x_vals] = get_starting_ending_values(max_num, x_between_offset, x_front_offset);
				console.log("[starting_x_vals, ending_x_vals]",[starting_x_vals, ending_x_vals]);
			}
		}};

		setTimeout(separate_for_hist(time_ran), 7000);
		function separate_for_hist(t){return function (){
			if ((get_active_section()==time_bin_zoom_to_histogram)&&(t==time_ran)){
				let duration = 1500;
				graph.selectAll(".ci_slice").transition().duration(duration).attr("x", (d,i)=>starting_x_vals[i]-1+x_front_offset)
					.attr("width", (d,i)=>ending_x_vals[i]-starting_x_vals[i]+2);
				graph.select(".slice").selectAll("rect").transition().duration(duration).attr("x", (d,i)=>starting_x_vals[i]+x_front_offset)
					.attr("width", (d,i)=>ending_x_vals[i]-starting_x_vals[i]);
				graph.selectAll("rect.ci_initial").data(moving_ci_data).enter().append("rect").attr("class","ci_initial")
					.attr("x", d=>0).attr("y",d=>yScale(d.y)).attr("height",d=>yScale(yScale.domain()[1]-d.height))
					.attr("width", x_front_offset+1).attr("fill", d=>d.c).attr("opacity", 0.25);
				setTimeout(function(){
					draw_average_firing_rate(t_20_color_data_original, data_length,2, 1).attr("x", 1);
					graph.select("g.bins").attr("class", "initial");
				});
				draw_multi_histogram(time_bin_zoom_to_histogram, bins, full_domain);
				setTimeout(function(){
					graph.selectAll(".color").attr("width", 0);
					graph.selectAll(".x.axis").selectAll(".tick").selectAll("text").attr("opacity", 1e-6);
					graph.selectAll(".x.axis").selectAll(".tick").selectAll("line").attr("y2",0).attr("opacity", 1e-6)
					.transition().duration(duration).attr("opacity", 1);
					
				},5)
			}
		}}

		setTimeout(rescale_for_hist(time_ran), 8500);
		function rescale_for_hist(t){return function (){
			if ((get_active_section()==time_bin_zoom_to_histogram)&&(t==time_ran)){
				yScale.domain(full_domain);
				transition_y_axis("Standard Deviations Away From Mean Firing Rate", "continous")
				graph.selectAll(".ci_slice").transition().duration(1000).attr("y",d=>yScale(d.y))
					.attr("height",d=>yScale(yScale.domain()[1]-d.height));
				graph.select(".slice").selectAll("rect").transition().duration(1000).attr("y",d=>yScale(d.d));
				graph.selectAll(".ci_initial").transition().duration(1000).attr("y",d=>yScale(d.y))
					.attr("height",d=>yScale(yScale.domain()[1]-d.height));
				graph.select(".initial").selectAll("rect").transition().duration(1000).attr("y",d=>yScale(d.d));
				
			}
		}}

		setTimeout(draw_the_multi_histogram(time_ran), 10000);
		function draw_the_multi_histogram(t){return function (){
			if ((get_active_section()==time_bin_zoom_to_histogram)&&(t==time_ran)){
				graph.selectAll(".color").transition().duration(2000).attr("width",d=>d.width);
				graph.selectAll(".ci_slice").transition().duration(2000).attr("opacity",1e-6).on("end", function(){
					this.remove()
				});
				graph.select(".slice").selectAll("rect").transition().duration(2000).attr("opacity",1e-6).on("end", function(){
					this.remove()
				});
				graph.selectAll(".x.axis").selectAll(".tick").selectAll("text").transition().duration(2000).attr("opacity", 1);
				graph.selectAll(".x.axis").selectAll(".tick").selectAll("line").transition().duration(2000).attr("y2",6);
			}
		}}
	}});
});
}

function draw_full_stimuli_histogram(called_section){
	time_ran = performance.now();
	norm_full_data.then(function(data){
	single_neuron_color_data.then(function(a_data){
	if (get_active_section()==called_section){
		[a_norm_color_data, a_cis] = data[neuron_a_number];
		var color_data= a_data[1];
		norm_color_data = JSON.parse(JSON.stringify(color_data)).map(function(trial){
			trial[time_bin_index].d = ((trial[time_bin_index].d-a_mean)/a_sd);
			return trial[time_bin_index];
		});
		
		var thresholds=15,
			d = norm_color_data.map(d=>d.d),
			data_length = x_domain[bin]().length
			full_domain = [d3.min(d), d3.max(d)],
			x_between_offset = w/(data_length*2),
			x_front_offset = w/data_length+2;
			bins = d3.histogram()
			.value(function(d){return d.d})
			.domain(full_domain)
			.thresholds(thresholds)
			(norm_color_data),
			t_20_color_data = a_norm_color_data.map(color=>[color[time_bin_index]]), // list of length #stimuli
			t_20_cis = a_cis.map(color=>[color[time_bin_index]]);

		xScale = bandScale;
		xScale.domain(x_domain[bin]());
		yScale = yLinearScale;
		yScale.domain(full_domain);

		var t_20_color_data=flatten(d3ify_avg_color_data(t_20_color_data).map(e=>e[0])).map(function(d){d.i=time_bin_index; return d});
		var a_norm_color_data = flatten(d3ify_avg_color_data(a_norm_color_data));
		var moving_ci_data = t_20_cis.map(function(color,i){
			return {c: ind_to_color_map[i], y:color[0][1], height: color[0][1]-color[0][0]}});

		setTimeout(draw_stim_hists(time_ran));
		function draw_stim_hists(t){return function(){
			if ((get_active_section()==called_section)&&(t==time_ran)){
				
				graph.selectAll("rect.ci_initial").data(moving_ci_data).enter().append("rect").attr("class","ci_initial")
					.attr("x", d=>0).attr("y",d=>yScale(d.y)).attr("height",d=>yScale(yScale.domain()[1]-d.height))
					.attr("width", x_front_offset+1).attr("fill", d=>d.c).attr("opacity", 0.25);
				setTimeout(function(){
					draw_average_firing_rate(t_20_color_data, data_length,2, 1).attr("x", 1);
					graph.select("g.bins").attr("class", "initial");
					draw_multi_histogram(called_section, bins, full_domain);
				});
		}}}

		setTimeout(display_p_value(time_ran), 10);
		function display_p_value(t){return function(){
			if ((get_active_section()==called_section)&&(t==time_ran)){
				anova_data.then(function(data){
					graph.append("g").attr("class","label");
					let edited_p_val = format_power(data[neuron_a_number][time_bin_index],false, 2);
					draw_label_with_bounding_box("P-value: "+edited_p_val,
						20, w*.75, h/4,
						graph.select("g.label"),"pval", false)
						
					;
				})
			}
		}};
		}});
	});
};

function stimuli_histogram_reveal(){
	remove_all();
	time_ran = performance.now();
	if (get_active_section()==stimuli_histogram_reveal){
		draw_full_stimuli_histogram(stimuli_histogram_reveal);
		draw_time_bin_buttons();
		draw_stimuli("all");
		setTimeout(reveal_p_value(time_ran), 50);
		function reveal_p_value(t){return function(){
			if ((get_active_section()==stimuli_histogram_reveal)&&(t==time_ran)){
				graph.selectAll(".pval").attr("opacity", 1e-6).transition().duration(1500).attr("opacity", 1);
			}
		}}
	}
};

function d3ify_p_value_data(p_value_data){
	if (typeof p_value_data[0].length =="undefined"){
		p_value_data = [p_value_data];
	}
	var to_return=[];
	for (var i=0; i<p_value_data.length;i++){
		to_return = to_return.concat(p_value_data[i].map(function(p, i){
			return {y: p, x: i}
		}))
	}
	return to_return
}
function get_starting_ending_values(max_num, x_between_offset, x_front_offset){
	var starting_x_vals = [],
		ending_x_vals = [],
		x = linearScale;
	x.domain([0,d3.sum(Object.values(max_num))]).range([0,w-x_between_offset*ind_to_color_map.length-x_front_offset]);

	for (color in color_to_ind_map) {
		ind = color_to_ind_map[color];
		starting_x_vals[ind] = (ind==0)?0: ending_x_vals[ind-1]+x_between_offset;
		ending_x_vals[ind] = (ind==0)? x(max_num[color]): starting_x_vals[ind]+x(max_num[color]);
	}
	return [starting_x_vals, ending_x_vals]
}
function get_bin_list_max_num_color_map_to_zero(bins){
	var color_bin_list = [];
	for (var i=0; i<bins.length; i++){
		color_bin_list[i] = bins[i].reduce(return_counts, {})
	}
	var color_map_to_zero = JSON.parse(JSON.stringify(color_to_ind_map));
		Object.keys(color_map_to_zero).map(function(key, index) {
			color_map_to_zero[key] =0;
	});
	var max_num = color_bin_list.reduce(function(aggregate, prev){
		for (color in prev){
			aggregate[color] = Math.max(aggregate[color], prev[color])
		}
		return aggregate
	}, color_map_to_zero);
	return [color_bin_list, max_num, color_map_to_zero];

}
function draw_multi_histogram(passed_section, bins, full_domain){
	var x_between_offset = w/62,
		x_front_offset = w/30+2,
		to_return;

	[color_bin_list, max_num, color_map_to_zero] = get_bin_list_max_num_color_map_to_zero(bins);

	[starting_x_vals, ending_x_vals] = get_starting_ending_values(max_num, x_between_offset, x_front_offset)
	yScale = yLinearScale;
	yScale.domain(full_domain);

	xScale = linearScale;
	xScale.domain([0,d3.sum(Object.values(max_num))]).range([0,w-x_between_offset*ind_to_color_map.length-x_front_offset]);
	draw_x_axis("Number of Trials", "hist");
	transition_multi_hist_axis(starting_x_vals, ending_x_vals, x_front_offset,0);
	draw_y_axis("Standard Deviations Away From Mean Firing Rate", "continous");
	color_bin_data_list = color_bin_list.map(function(bin, bin_ind){
		var datafied_colors = [];
		// get [x: prev x's + x(n), width: x(n), c:c, y: y(bin.x1), height: bin height]
		sorted_colors = Object.keys(bin).sort((color_a,color_b)=>color_to_ind_map[color_a]-color_to_ind_map[color_b]);
		for (var i = 0; i < sorted_colors.length; i++) {
			color = sorted_colors[i];
			datafied_colors[i] = {
				c: color, 
				width: xScale(bin[color]),
				x: (i==0)? x_front_offset: d3.sum(datafied_colors, d=>d.width)+x_front_offset,
				y: yScale(bins[bin_ind].x1),
				height: d3.max([Math.abs(yScale(bins[bin_ind].x0)-yScale(bins[bin_ind].x1))-2,0])
			}
		}
		return datafied_colors
	});
	setTimeout(show_stim_hists(time_ran),5);
	function show_stim_hists(t){return function(){
		if ((get_active_section()==passed_section)&&(t==time_ran)){
			to_return =  graph.selectAll(".color")
				.data(flatten(color_bin_data_list))
				.enter()
				.append("rect")
				.attr("class", "color")
				.attr("y", d=>d.y)
				.attr("height", d=>d.height)
				.attr("stroke", "#909090")
				.attr("stroke-width", 1)
				.attr("fill", d=>d.c)
				.attr("width", d=>d.width)
				.attr("x", d=>x_front_offset+starting_x_vals[color_to_ind_map[d.c]])
			};
		}
	};
	return to_return
}
var alpha = 0.01
function p_value_appear_time_bin(){
	remove_all();
	time_ran = performance.now();
	if (slider_has_not_been_set){
		curr_val_index = 2;
		slider_has_not_been_set=false;
	}
	anova_data.then(function(data){
	if (get_active_section()==p_value_appear_time_bin){
		//draw_full_stimuli_histogram(p_value_appear_time_bin);
		draw_stimuli("all");
		var first_data = data[neuron_a_number];
		first_data = d3ify_p_value_data(first_data);
		var full_p_data = d3ify_p_value_data(data),
			min_p = d3.min(full_p_data, d=>d.y),
			step_size  = 15,
			n_repeats = full_p_data.length/step_size,
			interval = 10;
		draw_slider("Alpha Value", range(7).map(d=>Math.pow(10, -d)), draw_anova, d=>format_power(d,true));
		xScale = bandScale;
		xScale.domain(x_domain[bin]());
		yScale = logScale;
		yScale.domain([min_p, 1]).clamp(true);
		setTimeout(function(){
			binned_data.then((bin_data)=> draw_x_axis("Time bins before/after stimulus is shown (ms)", "bins", bin_data[bin+"_extents"]));
			draw_y_axis("P-value of ANOVA", "continous", d=>format_power(d,true));
		
			graph.append("g").attr("class", "anova")
				.selectAll("rect")
				.data(first_data)
				.enter()
				.append("rect")
				.attr("x", d=>xScale(d.x))
				.attr("y", d=>yScale(d.y))
				.attr("fill",function(d){
					return (d.y<=alpha)?"#5cb85c":"#000";
				})
				.attr("width", xScale.bandwidth())
				.attr("height", 1);
			graph.append("rect")
				.attr("class", "alpha")
				.attr("y", yScale(alpha))
				.attr("x", 0)
				.attr("width", w)
				.attr("stroke", "#EF476F")
				.attr("fill" ,"#EF476F")
				.attr("height", 2);
		},2);


		setTimeout(draw_random_samples(time_ran), 500);
		function draw_random_samples(time){return function(){
			if ((get_active_section()==p_value_appear_time_bin)&&(time==time_ran)){
				var shuffled_full = shuffle(full_p_data),
					sampled_data=first_data;
				var t = d3.interval(function(elapsed) {
					if ((get_active_section()==p_value_appear_time_bin)){
						var i = Math.round(elapsed/interval);
						sampled_data = sampled_data.concat(shuffled_full.slice(step_size*i, step_size*i+step_size));
						graph.select("g.anova")
							.selectAll("rect")
							.data(sampled_data)
							.enter()
							.append("rect")
							.attr("x", d=>xScale(d.x))
							.attr("y", d=>yScale(d.y))
							.attr("fill",function(d){
								return (d.y<=alpha)?"#5cb85c":"#000";
							})
							.attr("width", xScale.bandwidth())
							.attr("height", 1);
					} if ((elapsed > interval*n_repeats)|| get_active_section()!=p_value_appear_time_bin){ 
						graph.select("g.anova")
							.selectAll("rect")
							.data(sampled_data)
							.enter()
							.append("rect")
							.transition()
							.duration(0)
							.attr("x", d=>xScale(d.x))
							.attr("y", d=>yScale(d.y))
							.attr("fill",function(d){
								return (d.y<=alpha)?"#5cb85c":"#000";
							})
							.attr("width", xScale.bandwidth())
							.attr("height", 1);
						t.stop();
					}
				}, interval);
		}}};
	}});
}
function draw_anova(event_x){
	alpha = event_x;
	restart_active_animation();
}
var superscript = "⁰¹²³⁴⁵⁶⁷⁸⁹";
function format_power(d, drop_term = false, min_sig_fig = 0) {
	var sig_fig = Math.abs(Math.round(Math.log(d) / Math.LN10)),
		to_return;
	if (sig_fig <= min_sig_fig){
		to_return = round(d, min_sig_fig);
	} else {
		to_return = (sig_fig + "").split("").map(function(c) { return superscript[c]; }).join(""); 
		if (d<1){
			to_return = "⁻"+to_return;
		}
		to_return = (drop_term)? "10"+to_return : d.toFixed(sig_fig+1)[sig_fig+2]+"x10"+to_return;
	}
	return to_return;
}

function percent_selective_over_time(){
	remove_all();
	time_ran = performance.now();
	if (slider_has_not_been_set){
		curr_val_index = 2;
		slider_has_not_been_set=false;
	}
	anova_data.then(function(data){
	if (get_active_section()==percent_selective_over_time){
		draw_stimuli("all");
		var full_p_data = d3ify_p_value_data(data),
			min_p = d3.min(full_p_data, d=>d.y),
		
		yScale = logScale;
		yScale.domain([min_p, 1]);
		xScale = bandScale;
		xScale.domain(x_domain[bin]());

		setTimeout(function(){
			binned_data.then((bin_data)=> draw_x_axis("Time bins before/after stimulus is shown (ms)", "bins", bin_data[bin+"_extents"]));
			draw_y_axis("P-value of ANOVA", "continous", d=>format_power(d,true));
			draw_slider("Alpha Value",range(7).map(d=>Math.pow(10, -d)), draw_anova, d=>format_power(d,true));
			graph.append("g")
				.attr("class","anova")
				.selectAll("rect")
				.data(full_p_data)
				.enter()
				.append("rect")
				.attr("x", d=>xScale(d.x))
				.attr("y", d=>yScale(d.y))
				.attr("class", function(d){
					return (d.y<=alpha)?"sig":"not";
				})
				.attr("fill",function(d){
					return (d.y<=alpha)?"#5cb85c":"#000";
				})
				.attr("width", xScale.bandwidth())
				.attr("height", 1);
			graph.append("rect")
				.attr("class", "alpha")
				.attr("y", yScale(alpha))
				.attr("x", 0)
				.attr("width", w)
				.attr("stroke", "#EF476F")
				.attr("fill" ,"#EF476F")
				.attr("height", 2);
		},2)
		
		var percents = range(data[0].length).map(i=>d3.sum(data, function(d){
			return (d[i]<=alpha)?1:0;
		})/data.length);
		setTimeout(transition_percents(time_ran), 1000);
		function transition_percents(t){return function(){
			if ((get_active_section()==percent_selective_over_time)&&(t==time_ran)){
				console.log("about to draw axis, yScale(1e-20)", yScale==logScale);
				yScale = yLinearScale;
				yScale.domain([0,1]);
				yAxis = d3.axisLeft(yScale);
				yAxis.tickFormat(d=>d*100+"%");
				graph.select('.y')
					.transition()
					.duration(1000)
					.call(yAxis)
					.selection()
					.select(".label")
					.text("Percent of Neurons that Are Selective");
				
				graph.select("rect.alpha").transition().attr("y", yScale(alpha)).duration(1000);
				graph.selectAll("rect.not").transition().attr("opacity",1e-6).duration(1000)
					.on("end", function(){this.remove()});

				var line = d3.line()
					.x((d,i) =>xScale(i))
					.y((d)=> yScale(d))
					.curve(d3.curveCardinal),
					r = 4;

				graph.selectAll("rect.sig")
					.transition()
					.attr("height",r*2)
					.attr("width", r*2)
					.attr("rx", 45)
					.attr("ry", 45)
					.attr("x", d=>xScale(d.x)-r)
					.attr("y",d=> yScale(percents[d.x])-r)
					.duration(1000)
					.on("end", function(d,j){
						if (j==0){
							graph.append("path")
							.datum(percents)
							.attr("stroke-width", 3)
							.attr("stroke", "#5cb85c")
							.attr("fill", "none")
							.attr("d", line);	
						}		
					})
			}
		}}
	}});
}
function decoding_shoutout(){
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
	11: neuron_magnitude_comparison,
	12: neuron_normalization,
	13: neuron_information_comparison,
	14: neuron_average,
	15: compared_neuron_separation,
	16: time_bin_zoom_to_histogram,
	17: stimuli_histogram_reveal,
	18: p_value_appear_time_bin,
	19: percent_selective_over_time,
	20: decoding_shoutout,
	21: conclusion
}

d3.graphScroll()
.graph(d3.selectAll('#graph'))
.container(d3.select('#container'))
.sections(d3.selectAll('#sections > div'))
.on('active', function(i){ 
	section_animations[i]();
});


