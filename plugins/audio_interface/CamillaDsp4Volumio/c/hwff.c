/*
 * hw_params.c - print hardware capabilities
 * in json formated for brutefir plugin for Volumio
 * Adapted by b@lbuze
 * compile with: gcc -o hw_params hwff.c -lasound
 * June 30th 2020
 */

#include <stdio.h>
#include <alsa/asoundlib.h>

#define ARRAY_SIZE(a) (sizeof(a) / sizeof *(a))

static const snd_pcm_access_t accesses[] = {
	SND_PCM_ACCESS_MMAP_INTERLEAVED,
	SND_PCM_ACCESS_MMAP_NONINTERLEAVED,
	SND_PCM_ACCESS_MMAP_COMPLEX,
	SND_PCM_ACCESS_RW_INTERLEAVED,
	SND_PCM_ACCESS_RW_NONINTERLEAVED,
};

static const snd_pcm_format_t formats[] = {
	SND_PCM_FORMAT_S16_LE,
	SND_PCM_FORMAT_S24_LE,
	SND_PCM_FORMAT_S24_3LE,
	SND_PCM_FORMAT_S32_LE,
};

static const unsigned int rates[] = {
	44100,
	48000,
	88200,
	96000,
	176400,
	192000,
};

int main(int argc, char *argv[])
{
	const char *device_name = "hw";
	snd_pcm_t *pcm;
	snd_pcm_hw_params_t *hw_params;
	unsigned int i;
	unsigned int min, max;
	int any_rate;
	int err;

	if (argc > 1)
		device_name = argv[1];

	err = snd_pcm_open(&pcm, device_name, SND_PCM_STREAM_PLAYBACK, SND_PCM_NONBLOCK);
	if (err < 0)
	{
		fprintf(stderr, "cannot open device '%s': %s\n", device_name, snd_strerror(err));
		return 1;
	}

	snd_pcm_hw_params_alloca(&hw_params);
	err = snd_pcm_hw_params_any(pcm, hw_params);
	if (err < 0)
	{
		fprintf(stderr, "cannot get hardware parameters: %s\n", snd_strerror(err));
		snd_pcm_close(pcm);
		return 1;
	}

	printf("{");

	putchar('\n');

	printf("\"formats\":{\"value\":\"");
	for (i = 0; i < ARRAY_SIZE(formats); ++i)
	{
		if (!snd_pcm_hw_params_test_format(pcm, hw_params, formats[i]))
			printf(" %s", snd_pcm_format_name(formats[i]));
	}
	printf("\"},");
	putchar('\n');

	err = snd_pcm_hw_params_get_channels_min(hw_params, &min);
	if (err < 0)
	{
		fprintf(stderr, "cannot get minimum channels count: %s\n", snd_strerror(err));
		snd_pcm_close(pcm);
		return 1;
	}
	err = snd_pcm_hw_params_get_channels_max(hw_params, &max);
	if (err < 0)
	{
		fprintf(stderr, "cannot get maximum channels count: %s\n", snd_strerror(err));
		snd_pcm_close(pcm);
		return 1;
	}
	//printf("channels:");
	printf("\"channels\":");
	if (!snd_pcm_hw_params_test_channels(pcm, hw_params, max))
		//printf(" %d", max);
		printf("{\"value\":\"%d\"},", max);
	putchar('\n');

	err = snd_pcm_hw_params_get_rate_min(hw_params, &min, NULL);
	if (err < 0)
	{
		fprintf(stderr, "cannot get minimum rate: %s\n", snd_strerror(err));
		snd_pcm_close(pcm);
		return 1;
	}
	err = snd_pcm_hw_params_get_rate_max(hw_params, &max, NULL);
	if (err < 0)
	{
		fprintf(stderr, "cannot get maximum rate: %s\n", snd_strerror(err));
		snd_pcm_close(pcm);
		return 1;
	}
	printf("\"samplerates\":{\"value\":\"");
	if (min == max)
		printf(" %u", min);
	else
	{
		for (i = 0; i < ARRAY_SIZE(rates); ++i)
		{
			if (!snd_pcm_hw_params_test_rate(pcm, hw_params, rates[i], 0))
			{
				any_rate = 1;
				printf(" %u", rates[i]);
			}
		}
	}
	printf("\"}");
	putchar('\n');
	printf("}");
	putchar('\n');

	snd_pcm_close(pcm);
	return 0;
}
