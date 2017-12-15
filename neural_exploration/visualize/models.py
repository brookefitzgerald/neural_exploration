from django.contrib.postgres.fields import ArrayField
from django.core.exceptions import FieldDoesNotExist
from django.db import models


class Experiment(models.Model):
    """Information about each experiment"""
    slug = models.CharField(max_length=30, unique=True)
    name = models.TextField()
    description = models.TextField()
    index_stimulus_shown = models.IntegerField()

    def __str__(self):
        return self.name


class Site(models.Model):
    """Site that data was recorded at"""
    experiment = models.ForeignKey(
        Experiment,
        on_delete=models.CASCADE
    )
    slug = models.CharField(max_length=30)

    def __str__(self):
        return str(self.experiment.slug + '-' + self.slug)


class Metadata(models.Model):
    """Metadata about a site recorded from during an experiment"""
    site = models.ForeignKey(
        Site,
        on_delete=models.CASCADE
    )
    information_variable = models.CharField(max_length=30)
    information_value = models.CharField(max_length=30)

    class Meta:
        verbose_name_plural = "metadata"

    def __str__(self):
        return str(str(self.site) + '-' + self.information_variable)


class Data(models.Model):
    """Data recorded from a site during an experiment with labels shown"""
    experiment = models.ForeignKey(
        Experiment,
        on_delete=models.CASCADE
    )
    site = models.ForeignKey(
        Site,
        on_delete=models.CASCADE
    )
    trial_number = models.IntegerField()
    label_one = models.CharField(max_length=30)
    label_two = models.CharField(max_length=30, null=True, blank=True)
    label_three = models.CharField(max_length=30, null=True, blank=True)
    label_four = models.CharField(max_length=30, null=True, blank=True)
    data = ArrayField(models.DecimalField(max_digits=15, decimal_places=10))

    class Meta:
        verbose_name_plural = "data"

    def __str__(self):
        return str(str(self.site) + '-' + str(self.trial_number))

    def filter_by_label(self, experiment, input_label, label_number=1):
        if label_number == 1:
            stimuli = self.objects.filter(label_one=input_label)
        elif label_number == 2:
            stimuli = self.objects.filter(label_two=input_label)
        elif label_number == 3:
            stimuli = self.objects.filter(label_three=input_label)
        elif label_number == 4:
            stimuli = self.objects.filter(label_four=input_label)
        else:
            raise FieldDoesNotExist()
        return stimuli

    def compute_binned_data(self, bin_size, step_size):
        pass
