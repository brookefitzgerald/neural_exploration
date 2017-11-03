from django.contrib.postgres.fields import ArrayField
from django.db import models


EXAMPLE_DATA_ARRAY_LENGTH = 701


class Experiment(models.Model):
    """Metadata about Experiment"""
    index_stimulus_shown = models.IntegerField()
    recording_date = models.DateField(null=True)
    channel_region = models.CharField(30, null=True)
    channel_id = models.CharField(30, null=True)


class Data(models.Model):
    """Model of a single recording in an experiment"""
    experiment = models.ForeignKey(
        Experiment,
        on_delete=models.CASCADE
    )
    label = models.CharField(30)
    region_id = models.IntegerField()
    data = ArrayField(models.DecimalField(), size=EXAMPLE_DATA_ARRAY_LENGTH)

    objects = models.Manager()

    def get_stimuli(self, input_label):
        return self.objects.filter(label=input_label)

    def compute_binned_data(self, bin_size, step_size):
        pass
