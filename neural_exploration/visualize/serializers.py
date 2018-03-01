from django.apps import apps

from rest_framework import serializers

Experiment = apps.get_model("visualize", "Experiment")
Site = apps.get_model("visualize", "Site")
BinnedData = apps.get_model("visualize", "BinnedData")


class ExperimentSerializer(serializers.ModelSerializer):
    """JSON serialized representation of the Experiment Model"""
    class Meta:
        model = Experiment
        fields = '__all__'


class DataSerializer(serializers.ModelSerializer):
    """JSON serialized representation of the Data Model"""
    experiment = ExperimentSerializer(many=False, read_only=True)

    class Meta:
        model = Site
        fields = ('data', 'slug', 'labels_one', 'labels_two',
                  'labels_three', 'labels_four', 'experiment')


class BinSerializer(serializers.ModelSerializer):
    """JSON representation of the Binned Data"""
    class Meta:
        model = BinnedData
        fields = '__all__'
