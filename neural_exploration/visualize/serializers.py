from django.apps import apps

from rest_framework import serializers

Experiment = apps.get_model("visualize", "Experiment")


class ExperimentSerializer(serializers.ModelSerializer):
    """JSON serialized representation of the Experiment Model"""
    class Meta:
        model = Experiment
        fields = '__all__'

class InnerListField(serializers.ListField):
    child = serializers.DecimalField(max_digits=15, decimal_places=10)

class IntInnerListField(serializers.ListField):
    child=serializers.IntegerField()


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
    bin_150_50_extents = serializers.ListField(child=IntInnerListField())
    labels = serializers.ListField(child=serializers.CharField())


class SecondBinSerializer(serializers.Serializer):
    """JSON representation of the Binned Data"""
    bin_100_30=serializers.ListField(child=InnerListField())
    bin_100_30_extents = serializers.ListField(child=IntInnerListField())
    labels = serializers.ListField(child=serializers.CharField())


class ThirdBinSerializer(serializers.Serializer):
    """JSON representation of the Binned Data"""
    bin_50_15=serializers.ListField(child=InnerListField())
    bin_50_15_extents = serializers.ListField(child=IntInnerListField())
    labels = serializers.ListField(child=serializers.CharField())

