from django.apps import apps
from django.shortcuts import render

from rest_framework import renderers, viewsets, status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .serializers import DataSerializer, FirstBinSerializer, SecondBinSerializer, ThirdBinSerializer


def SpikeDataView(request):
    zhang_experiment = (
        apps.get_model("visualize", "Experiment")
        .objects
        .filter(slug='zhang'))[0]

    zhang_data = (
        apps.get_model("visualize", "Site")
        .objects
        .filter(experiment=zhang_experiment)
        .first())
    context = {
        "data": zhang_data,
        "host": request.META.get('HTTP_HOST')
    }
    return render(request, "visualize/spike.html", context)


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
        json_data = renderers.JSONRenderer().render(serializer.data)
        return Response(json_data)


@api_view(['GET'])
def data_detail(request, pk):
    """ get data from specific site """
    try:
        data = (apps
            .get_model("visualize", "Site")
            .objects
            .get(pk=pk))
    except data.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = DataSerializer(data)
        json_data = renderers.JSONRenderer().render(serializer.data)
        return Response(json_data)


def get_queryset_of_bin_size(i):
    bin_size_dict = {
        "1": "bin_150_50",
        "2": "bin_100_30",
        "3": "bin_50_15",
        }
    try: 
        return (apps
                .get_model("visualize", "BinnedData")
                .objects
                .all()
                .only(bin_size_dict[i], bin_size_dict[i]+"_extents", "labels"))
    except:
        return Response(status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
def binned_filter_detail(request, i, pk):
    """ Get specific data with specific bin size"""
    bin_serializer_dict = {
        "1":  FirstBinSerializer,
        "2": SecondBinSerializer,
        "3": ThirdBinSerializer}
    try:
        data = (get_queryset_of_bin_size(i)
            .get(pk=pk))
    except:
        return Response(status=status.HTTP_404_NOT_FOUND)
    if request.method == 'GET':
        serializer = bin_serializer_dict[i](data)
        json_data = renderers.JSONRenderer().render(serializer.data)
        return Response(json_data)


@api_view(['GET'])
def binned_filter_list(request, i):
    """ Get all data with specific bin size"""
    bin_serializer_dict = {
        "1":  FirstBinSerializer,
        "2": SecondBinSerializer,
        "3": ThirdBinSerializer}
    if request.method == 'GET':
        data = get_queryset_of_bin_size(i)
        serializer = bin_serializer_dict[i](data, many=True)
        json_data = renderers.JSONRenderer().render(serializer.data)
        return Response(json_data)
