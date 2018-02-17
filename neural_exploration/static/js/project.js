$('.form-group').removeClass('row');

d3.graphScroll()
.sections(d3.selectAll('#sections > div'))
.on('active', function(i){
	console.log(i + 'th section active') });