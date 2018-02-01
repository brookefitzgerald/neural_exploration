from django.apps import apps
from django.core.serializers.json import DjangoJSONEncoder
from django.shortcuts import render

import ipdb
import json
from rest_framework import renderers, viewsets

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
    data = renderers.JSONRenderer().render(serializer.data)
    return render(request, "visualize/spike.html", {"experiment": data})
