$('.form-group').removeClass('row');

var section_animations = {
	0: brain_pulse,
	1: test_function1,
	2: test_function2
}
d3.graphScroll()
	.graph(d3.selectAll('#graph'))
	.container(d3.select('#container'))
  .sections(d3.selectAll('#sections > div'))
  .on('active', function(i){ section_animations[i](); })

var brain_pulse = function(){
	console.log('brain_pulse');
}

var test_function1 = function(){
	console.log('testing 1');
}

var test_function2 = function(){
	console.log('testing 2');
}