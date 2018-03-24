$('.form-group').removeClass('row');

var margin = {top: 30, right: 13, bottom: 50, left: 60}

var svg = d3.select("svg");

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

var graph = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

var x_domain = {full: [0,1000], bin_150_50: Array.from(Array(18).keys()),bin_100_30: Array.from(Array(31).keys()), bin_50_15: Array.from(Array(64).keys())};
var y_domain = {full: [0,1], bin_150_50: [0,1],bin_100_30: [0,1], bin_50_15: [0,1]};

// setup x 
var linearScale = d3.scaleLinear().range([0, w]),
	xScale = linearScale,
	bandScale = d3.scaleBand().range([0, w]),
	xAxis = d3.axisBottom(xScale);

// setup y
var yScale = d3.scaleLinear().range([h, 0]), // value -> display
	yAxis = d3.axisLeft(yScale);

// variables for data access
var data_pk = 100,
	stimuli_display_number = 0,
	bin_id = 2,
	bin = {1: "bin_150_50", 2: "bin_100_30", 3: "bin_50_15"}[bin_id],
	bin_width = (isNaN(+bin.slice(4,7))? +bin.slice(4,6) : +bin.slice(4,7));

var initial_data = dataLoad('http://'+host+'/spike/data/'+data_pk).then(function(response){
	let data = JSON.parse(response);
	data.data = data.data.map(showing=>showing.map(Number));
	x_domain.full = [0, data.data[stimuli_display_number].length];
	y_domain.full = [0,1]
	return data}, function(Error) {
		console.log(Error);
	});

var binned_data = dataLoad('http://'+host+'/spike/bin/'+bin_id+'/'+data_pk).then(
	function(response) {
		let data = JSON.parse(response);
		data[bin] = data[bin].map(showing=>showing.map(Number));
		x_domain[bin] = Array.from(Array(data[bin+"_extents"].length).keys());
		y_domain[bin] = [0,d3.max(data[bin][stimuli_display_number])];
		return data;
	}, function(Error) {
		console.log(Error);
	});

var scroll_text = function(text_data, time){
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

var brain_pulse = function(){
	// SVG of brain appearing with data streaming by
	time = 4000;
	text_data = [
	{text:'000100011000',startx: w-(w/3), duration: time/3*(2/3)},
	{text:'111000110101',startx: 0, duration: time*(2/3)},
	{text:'010000000001',startx: w/2, duration: time/2*(2/3)},
	{text:'101001000011',startx: w, duration: 0}
	];
	svg.select("#brain")
	.attr("height",'90%')
	.attr("width",'90%');
	scroll_text(text_data, time);
	return;
}

var zoom_to_neuron = function(){
	svg.select("#brain")
	.attr("width",0)
	.attr("height",0);
	svg.selectAll("text").remove();
	return;
}

var neuron_spike = function(){
	graph.selectAll("*").remove()
	return;
}


var draw_x_axis = function(x_label, type, bin_extents=null){
	xAxis = d3.axisBottom(xScale);
	// x-axis
	if (type=="bins"){
		xAxis.tickFormat(n=>bin_extents[n][0]+"-"+bin_extents[n][1]);
		var transform = "translate(-"+(xScale.bandwidth()-5)+",15) rotate(-45)",
			y_displacement = 50;
	} else {
		var transform = "translate(0,0)",
			y_displacement = 30;
	}
	graph.append("g")
		.attr("class", "x axis")
		.attr("transform", "translate(0," + h + ")")
		.call(xAxis)
		.selectAll("text")
		.attr("transform",transform);

	graph.selectAll(".x")
		.append("text")
		.attr("fill", "#000")
		.attr("x", w/2)
		.attr("y", y_displacement)
		.attr("class", "x label")
		.attr("transform", "translate(0,0)")
		.text(x_label);
}

var transition_x_axis = function(x_label, type, bin_extents=null, delay=0, duration=0) {
	xAxis = d3.axisBottom(xScale);
	// x-axis
	if (type=="bins"){
		xAxis.tickFormat(n=>bin_extents[n][0]+"-"+bin_extents[n][1]);
		var transform = "translate(-"+(xScale.bandwidth()-5)+",15) rotate(-45)",
			y_displacement = 50;
	} else {
		var transform = "translate(0,0)",
			y_displacement = 30;
	}
	graph.select('.x')
		.transition()
		.delay(delay)
		.call(xAxis)
		.selection()
		.selectAll("text:not(.label)")
		.attr("transform", transform);

	graph.selectAll('.x.label')
		.transition()
		.delay(delay)
		.attr("y", y_displacement)
		.text(x_label);
}

var draw_y_axis = function(y_label, type){
	yAxis = d3.axisLeft(yScale);
	// y-axis
	if (type=="boolean"){
		yAxis.tickValues([0,1])
		.tickFormat(d3.format(".1"));
	} else if (type=="continuous"){
		yAxis.tickValues(null)
		.tickFormat(null);
	}
	graph.append("g")
		.attr("class", "y axis")
		.call(yAxis)
		.append("text")
		.attr("fill", "#000")
		.attr("x", -h/2+margin.top)
		.attr("y", -50)
		.attr("transform","rotate(-90)")
		.attr("class", "y label")
		.text(y_label);
}

var transition_y_axis = function(y_label, type, bin_extents=null, delay=0, duration=0) {
	yAxis = d3.axisLeft(yScale);
	// y-axis
	if (type=="boolean"){
		yAxis.tickValues([0,1])
		.tickFormat(d3.format(".1"));
	} else if (type=="continuous"){
		yAxis.tickValues(null)
		.tickFormat(null);
	}
	graph.select('.y')
		.transition()
		.delay(delay)
		.duration(1000)
		.call(yAxis)
		.selection()
		.select(".label")
		.text(y_label);
}

var draw_spikes = function(){
	xScale = linearScale;
	xScale.domain(x_domain.full);
	yScale.domain(y_domain.full); 
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
var single_neuron_spike_train = function(){
	// draws a single neuron spike train with axes
	draw_spikes();
	draw_x_axis("Time (ms)", "full");
	draw_y_axis("Spike detected", "boolean");
	return;
}
var zoom_to_inferior_temporal_cortex = function(){
	graph.selectAll(".data").remove();
	graph.selectAll(".axis").remove();
	return;
}
var show_stimuli = function(){
	graph.selectAll(".bins").remove();
	graph.selectAll(".data").remove();
	graph.selectAll(".axis").remove();
	return;
}

var bin_average = function(){
	draw_spikes();
	draw_x_axis("Time (ms)", "full");
	draw_y_axis("Spike detected", "boolean");
	binned_data.then(function(data){
		let max_height=yScale(y_domain[bin][1]),
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
						if (i==(data[bin+"_extents"].length-1)){
							xScale = bandScale.domain(x_domain[bin]);
							graph.selectAll("g.bins")
								.selectAll("rect")
								.data(data[bin][stimuli_display_number])
								.transition()
								.duration(1000)
								.attr("x",(d,j)=>xScale(j))
								.attr("width", xScale.bandwidth())
								.attr("y", d=>yScale(d))
								.attr("height", 2)
								.attr("rx", 1/2)
								.attr("ry", 1/2)
								.attr("stroke", "#000000")
								.attr("stroke-width",2)
								.on("start", function(d,j){
									spike_nodes.slice(j,j*bin_width).map(node=>node.remove());
									if (j==(x_domain[bin].length-1)){
										transition_y_axis("Average Firing Rate", "continuous");
										transition_x_axis("Time Bins (ms)", "bins", data[bin+"_extents"]);
									}})
								.on("end", function(d,j){
									if (j==(x_domain[bin].length-1)){
										yScale.domain(y_domain[bin]);
										graph.selectAll("g.bins")
											.selectAll("rect")
											.transition()
											.delay(500)
											.duration(1000)
											.attr("y",d=>yScale(d))
											.on("end", function(d,j){
												graph.selectAll("g.bins")
													.selectAll("rect")
													.data(data[bin][stimuli_display_number].concat(data[bin][stimuli_display_number]))
													.enter()
													.append("rect")
													.attr("x",(d,j)=>xScale(j))
													.attr("width", 2)
													.attr("y", d=>yScale(d))
													.attr("height", function(d,j){
														console.log("here");
														console.log(j)
														if (j==data[bin][stimuli_display_number].length){
															return 0;
														} else {
															let y_diff = Math.abs(d-data[bin][stimuli_display_number][j-1]);
															return yScale(y_diff);
														}
													})
													.attr("rx", 1/2)
													.attr("ry", 1/2)
													.attr("stroke", "#000000")
													.attr("stroke-width",2);
											});
											
										transition_y_axis("Average Firing Rate", "continuous", 500, 1000);
									}

								});
						}

					});
	});
	return;
}
var question = function(){
	graph.selectAll(".bins").remove();
	graph.selectAll(".data").remove();
	graph.selectAll(".axis").remove();
	return;
}
var trial_average = function(){
	return;
}
var confidence_intervals = function(){
	return;
}
var neuron_average = function(){
	return;
}
var neuron_information_comparison = function(){
	return;
}
var compared_neuron_averaging = function(){
	return;
}
var compared_neuron_separation = function(){
	return;
}
var no_information_expectation = function(){
	return;
}
var average_firing_rate_histogram = function(){
	return;
}
var percent_selective_per_bin_hist_on_hover = function(){
	return;
}
var overall_percent_selective_top_three_filter = function(){
	return;
}
var machine_animation = function(){
	return;
}
var data_predictive_accuracy_collected_in_time_bin_graph = function(){
	return;
}
var swapped_data_null_accuracy_collected_in_time_bin_graph = function(){
	return;
}
var accuracy_compared_with_null_distribution_creation = function(){
	return;
}
var predictions_with_most_selective_neurons = function(){
	return;
}
var what_we_learned = function(){
	return;
}
var conclusion = function(){
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
	10: neuron_average,
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


