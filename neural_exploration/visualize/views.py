from django.apps import apps
from django.core.serializers.json import DjangoJSONEncoder
from django.shortcuts import render


import json
import ipdb
from rest_framework import renderers, viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .serializers import DataSerializer


def SpikeDataView(request):
    zhang_experiment = (
        apps.get_model("visualize", "Experiment")
        .objects
        .filter(slug='zhang'))[0]

    zhang_data = (
        apps.get_model("visualize", "Site")
        .objects
        .filter(experiment=zhang_experiment))[0]
    serializer = DataSerializer(zhang_data, many=False)
    data = renderers.JSONRenderer().render(serializer.data)
    return render(request, "visualize/spike.html", {"data": data})


@api_view(['GET'])
def data_list(request):
    if request.method == 'GET':
        data = (
            apps
            .get_model("visualize", "Site")
            .objects
            .all()
            )
        serializer = DataSerializer(data, many=True)
        return Response(serializer.data)

@api_view(['GET'])
def data_detail(request, pk):
    """
    Retrieve, update or delete a code snippet.
    """
    try:
        data = (apps
            .get_model("visualize", "Site")
            .objects
            .get(pk=pk))
    except data.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = DataSerializer(data)
        return Response(serializer.data)