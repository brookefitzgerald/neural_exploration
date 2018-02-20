$('.form-group').removeClass('row');

d3.select('#graph').append("svg").attr("width","100%").attr("height","100%");

var graph = d3.select("svg");

var brain_pulse = function(){
	console.log('brain_pulse');
}

var test_function1 = function(){
	console.log('testing 1');
	graph.append("rect").attr("fill", "green")
	.attr("x",0).attr("y",0).attr("width","100%").attr("height","100%");
}

var test_function2 = function(){
	console.log('testing 2');
}

var section_animations = {
	0: function(){},
	1: brain_pulse,
	2: test_function1,
	3: test_function2
}


d3.graphScroll()
	.graph(d3.selectAll('#graph'))
	.container(d3.select('#container'))
	.sections(d3.selectAll('#sections > div'))
	.on('active', function(i){ 
		section_animations[i]();
})

