from django.apps import apps

from rest_framework import serializers

Experiment = apps.get_model("visualize", "Experiment")
Data = apps.get_model("visualize", "Data")


class ExperimentSerializer(serializers.ModelSerializer):
    """JSON serialized representation of the Experiment Model"""
    class Meta:
        model = Experiment
        fields = '__all__'


class DataSerializer(serializers.ModelSerializer):
    """JSON serialized representation of the Data Model"""
    experiment = ExperimentSerializer(many=False, read_only=True)

    class Meta:
        model = Data
        fields = ('data', 'trial_number', 'label_one', 'label_two',
                  'label_three', 'label_four', 'experiment')
