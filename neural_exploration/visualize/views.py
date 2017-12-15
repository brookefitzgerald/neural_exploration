from django.shortcuts import render
from django.apps import apps

from rest_framework.renderers import JSONRenderer

from .serializers import DataSerializer


def SpikeDataView(request):
    zhang_experiment = (
        apps.get_model("visualize", "Experiment")
        .objects
        .filter(slug='zhang'))[0]
    zhang_data = (
        apps.get_model("visualize", "Data")
        .objects
        .filter(experiment=zhang_experiment))[0]

    serializer = DataSerializer(zhang_data)

    return render(request, "visualize/spike.html", serializer.data)
