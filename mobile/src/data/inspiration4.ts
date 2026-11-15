/**
 * REAL astronaut research data: complete blood count of the four SpaceX Inspiration4 crew members
 * (L = days before launch, R = days after return). Aggregated (mean/min/max across the crew) from the public NASA OSDR
 * dataset OSD-569. Generated from the source CSV, not typed by hand. De-identified. https://osdr.nasa.gov/bio/repo/data/studies/OSD-569
 */
export const INSPIRATION4 = {
  "source": "NASA OSDR OSD-569 (SpaceX Inspiration4), file LSDS-7_Complete_Blood_Count_CBC_TRANSFORMED.csv",
  "timepoints": [
    "L-92",
    "L-44",
    "L-3",
    "R+1",
    "R+45",
    "R+82",
    "R+194"
  ],
  "crew": 4,
  "markers": [
    {
      "key": "wbc",
      "label": "White blood cells",
      "unit": "K/µL",
      "mean": [
        7.3,
        6.65,
        8.65,
        6.4,
        6.48,
        6.72,
        6.75
      ],
      "min": [
        5.4,
        5.4,
        7,
        5,
        4.9,
        4.9,
        4.9
      ],
      "max": [
        9.6,
        9.3,
        10.6,
        8.1,
        7.8,
        8.8,
        8.3
      ],
      "refMin": 3.8,
      "refMax": 10.8
    },
    {
      "key": "lymph",
      "label": "Lymphocytes (absolute)",
      "unit": "cells/µL",
      "mean": [
        3243,
        1884.25,
        2910.75,
        1855.25,
        2334.25,
        2356.5,
        2319.75
      ],
      "min": [
        1786,
        1613,
        2667,
        1540,
        1938,
        1701,
        1847
      ],
      "max": [
        6826,
        2083,
        3156,
        2155,
        2874,
        3247,
        2639
      ],
      "refMin": 850,
      "refMax": 3900
    },
    {
      "key": "neut",
      "label": "Neutrophils (absolute)",
      "unit": "cells/µL",
      "mean": [
        2707.53,
        3994.5,
        4845.25,
        3657.25,
        3300.25,
        3515.75,
        3466.25
      ],
      "min": [
        10.1,
        2873,
        3570,
        2685,
        2200,
        1994,
        2391
      ],
      "max": [
        4766,
        6408,
        6318,
        4528,
        4618,
        4576,
        4200
      ],
      "refMin": 1500,
      "refMax": 7800
    },
    {
      "key": "plt",
      "label": "Platelets",
      "unit": "K/µL",
      "mean": [
        183.47,
        259.5,
        290.25,
        269.5,
        289.25,
        261.25,
        224.5
      ],
      "min": [
        12.9,
        227,
        241,
        227,
        228,
        198,
        185
      ],
      "max": [
        241,
        345,
        367,
        359,
        396,
        345,
        256
      ],
      "refMin": 140,
      "refMax": 400
    },
    {
      "key": "hgb",
      "label": "Hemoglobin",
      "unit": "%",
      "mean": [
        14.38,
        14.68,
        14.07,
        14.2,
        14.48,
        14.5,
        14.15
      ],
      "min": [
        13.2,
        12.8,
        11.5,
        12.1,
        12.2,
        11.5,
        12.7
      ],
      "max": [
        17,
        16.6,
        16.8,
        16.5,
        16.8,
        16.4,
        16.5
      ],
      "refMin": 13.2,
      "refMax": 17.1
    },
    {
      "key": "rbc",
      "label": "Red blood cells",
      "unit": "M/µL",
      "mean": [
        4.72,
        4.74,
        4.58,
        4.77,
        4.82,
        4.8,
        4.75
      ],
      "min": [
        4.36,
        3.93,
        3.72,
        4.02,
        4.02,
        3.84,
        4.11
      ],
      "max": [
        5.48,
        5.57,
        5.4,
        5.55,
        5.54,
        5.45,
        5.58
      ],
      "refMin": 4.2,
      "refMax": 5.8
    }
  ]
} as const;
