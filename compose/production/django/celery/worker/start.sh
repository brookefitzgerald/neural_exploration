#!/usr/bin/env bash

set -o errexit
set -o pipefail
set -o nounset


celery -A neural_exploration.taskapp worker -l INFO
