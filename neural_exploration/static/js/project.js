$('.form-group').removeClass('row');

var margin = {top: 30, right: 20, bottom: 50, left: 50}

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

var graph = svg.append("g")
	.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

// setup x 
var xScale = d3.scaleLinear().range([0, w]),
    xAxis = d3.axisBottom(xScale);

// setup y
var yScale = d3.scaleLinear().range([h, 0]), // value -> display
    yAxis = d3.axisLeft(yScale);

var initial_data = dataLoad('http://'+host+'/spike/data/100').then(function(response){
		let data = JSON.parse(response);
		data.data = data.data.map(showing=>showing.map(Number));
		xScale.domain([0, data.data[0].length]);
		yScale.domain([0, 1]);
		return data});

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


var draw_time_x_axis = function(x_label){
	// x-axis
	graph.append("g")
    	.attr("class", "x axis")
    	.attr("transform", "translate(0," + h + ")")
    	.call(xAxis)
    	.append("text")
    		.attr("fill", "#000")
    		.attr("x", w/2)
      		.attr("y", 30)
      		.attr("class", "label")
      		.text(x_label);
}

var draw_y_axis = function(y_label, type){
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
      		.attr("y", -30)
      		.attr("transform","rotate(-90)")
	    	.attr("class", "label")
	    	.text(y_label);
}
var single_neuron_spike_train = function(){
	// draws a single neuron spike train with axes 
	initial_data.then(function(data){
		var num_points = data.data[0].length
		graph.append("g")
			.attr("class", "data")
			.selectAll("rect")
			.data(data.data[0])
			.enter()
			.append("rect")
				.attr("x", (d,i)=>xScale(i))
				.attr("y", d=>yScale(d))
				.attr("width", 1)
				.attr("height", d=>d*yScale(0))
				.attr("rx", 1/2)
				.attr("ry", 1/2);
		draw_time_x_axis("Time (ms)")
		draw_y_axis("Spike detected", "boolean");
	});
	return;
}
var zoom_to_inferior_temporal_cortex = function(){
	graph.selectAll(".data").remove()
	return;
}
var show_stimuli = function(){

	return;
}
var bin_average = function(){
	dataLoad('http://'+host+'/spike/bin/1/30').then(
	    function(response) {
	    	console.log(response)
	        var data = JSON.parse(response);
	        d3.select("div#container")
	        .append("p")
	        .attr("id", "myNewParagrap")
	        .append("text")
	        .text(data.trial_number);
	    }, function(Error) {
	        console.log(Error);
    });
	return;
}
var question = function(){

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


