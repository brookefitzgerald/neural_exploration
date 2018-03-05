from django.apps import apps

from rest_framework import serializers
import ipdb

Experiment = apps.get_model("visualize", "Experiment")
Site = apps.get_model("visualize", "Site")
BinnedData = apps.get_model("visualize", "BinnedData")


class ExperimentSerializer(serializers.ModelSerializer):
    """JSON serialized representation of the Experiment Model"""
    class Meta:
        model = Experiment
        fields = '__all__'

class InnerListField(serializers.ListField):
    child = serializers.DecimalField(max_digits=15, decimal_places=10)


class CharListField(serializers.ListField):
    child = serializers.CharField()


class DataSerializer(serializers.Serializer):
    """JSON serialized representation of the Data Model"""
    experiment = ExperimentSerializer(many=False, read_only=True)
    slug = serializers.CharField()
    labels_one = CharListField()
    labels_two = CharListField()
    labels_three = CharListField()
    labels_four = CharListField()
    data = serializers.ListField(child=InnerListField())


class FirstBinSerializer(serializers.Serializer):
    """JSON representation of the Binned Data"""
    bin_150_50 = serializers.ListField(child=InnerListField())


class SecondBinSerializer(serializers.Serializer):
    """JSON representation of the Binned Data"""
    bin_100_30=serializers.ListField(child=InnerListField())


class ThirdBinSerializer(serializers.Serializer):
    """JSON representation of the Binned Data"""
    bin_50_15=serializers.ListField(child=InnerListField())

