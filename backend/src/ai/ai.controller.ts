    if (dto.mode === 'streaming' && result.stream) {
      return result.stream.toTextStreamResponse();
    }