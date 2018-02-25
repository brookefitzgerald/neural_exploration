$('.form-group').removeClass('row');

d3.select('#graph').append("svg").attr("width","100%").attr("height","100%");

var graph = d3.select("svg"),
	pixw = graph.style('width'),
	w = pixw.slice(0,pixw["length"]-2)*1;

var pixh = graph.style('height'),
	h = pixh.slice(0,pixh["length"]-2)*1;

var brain_pulse = function(){
	// SVG of brain appearing with data streaming by
	var time = 4000;
	text_data = [
		{text:'000100011000',startx: w-(w/3), duration: time/3*(2/3)},
		{text:'111000110101',startx: 0, duration: time*(2/3)},
		{text:'010000000001',startx: w/2, duration: time/2*(2/3)},
		{text:'101001000011',startx: w, duration: 0}
	];
	graph.append('image')
		.attr('xlink:href',link)
		.attr('height', '90%')
		.attr('width', '90%');

	graph.selectAll("text")
		.data(text_data)
		.enter()
		.append('text')
		.text(d=> d.text)
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

var zoom_to_neuron = function(){
	graph.selectAll("*").remove();
	return;
}

var neuron_spike = function(){
	return;
}
var single_neuron_spike_train = function(){
	return;
}
var zoom_to_inferior_temporal_cortex = function(){
	return;
}
var show_stimuli = function(){
	return;
}
var bin_average = function(){
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


