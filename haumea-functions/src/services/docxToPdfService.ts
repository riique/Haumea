/**
 * DOCX to PDF Conversion Service
 * 
 * Converts DOCX files to PDF format before sending to OpenRouter
 * OpenRouter can properly process PDFs but not DOCX files
 * 
 * Features:
 * - Text extraction and formatting preservation
 * - Image extraction and embedding
 * - Bold, italic, headings support
 * - List formatting (bullets, numbering)
 */

import * as mammoth from 'mammoth';
import { PDFDocument, StandardFonts, PDFImage, rgb } from 'pdf-lib';
import { logger } from '../utils/logger';

export interface ConversionResult {
  success: boolean;
  pdfBuffer?: Buffer;
  pdfBase64?: string;
  error?: string;
}

interface TextSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  heading?: number; // 1-6 for h1-h6
  isBullet?: boolean;
  isNumbered?: boolean;
}

interface ParsedElement {
  type: 'text' | 'image' | 'break';
  segments?: TextSegment[];
  imageData?: string; // base64
  imageType?: string; // png, jpeg
}

export class DocxToPdfService {
  /**
   * Convert DOCX file to PDF
   * Downloads the DOCX from URL, converts to PDF, returns as buffer
   */
  async convertDocxUrlToPdf(docxUrl: string, fileName: string): Promise<ConversionResult> {
    try {
      logger.info('Starting DOCX to PDF conversion', { fileName });

      // Download DOCX file from URL
      const docxResponse = await fetch(docxUrl);
      if (!docxResponse.ok) {
        throw new Error(`Failed to download DOCX: ${docxResponse.statusText}`);
      }

      const docxBuffer = Buffer.from(await docxResponse.arrayBuffer());

      // Extract content with mammoth including images
      const extractionResult = await this.extractDocxContent(docxBuffer);

      // Parse HTML to structured elements
      const elements = this.parseHtmlToElements(extractionResult.html);

      // Create PDF with formatting and images
      const pdfBuffer = await this.createFormattedPdf(elements, extractionResult.images, fileName);
      const pdfBase64 = pdfBuffer.toString('base64');

      logger.info('DOCX converted to PDF successfully', { 
        pdfSize: pdfBuffer.length,
        imageCount: extractionResult.images.length
      });

      return {
        success: true,
        pdfBuffer,
        pdfBase64
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('Error converting DOCX to PDF', {
        error: errorMessage,
        stack: errorStack,
        fileName
      });
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Extract HTML and images from DOCX
   */
  private async extractDocxContent(docxBuffer: Buffer): Promise<{ html: string; images: Array<{ id: string; buffer: Buffer; type: string }> }> {
    const images: Array<{ id: string; buffer: Buffer; type: string }> = [];
    
    try {
      // Configure mammoth to extract images
      const result = await mammoth.convertToHtml(
        { buffer: docxBuffer },
        {
          convertImage: mammoth.images.imgElement(async (image) => {
            try {
              const imageBuffer = await image.read();
              const imageId = `img_${images.length}`;
              
              // Detect image type from content type
              const contentType = image.contentType || 'image/png';
              const imageType = contentType.split('/')[1] || 'png';
              
              images.push({
                id: imageId,
                buffer: Buffer.from(imageBuffer),
                type: imageType
              });
              
              // Return placeholder in HTML
              return { src: imageId };
            } catch (imageError) {
              logger.warn('Failed to extract image, skipping', { 
                error: imageError instanceof Error ? imageError.message : 'Unknown error' 
              });
              // Return empty src to skip this image
              return { src: '' };
            }
          })
        }
      );

      if (result.messages && result.messages.length > 0) {
        logger.warn('Mammoth conversion warnings', { messageCount: result.messages.length });
      }

      return {
        html: result.value,
        images
      };
    } catch (error) {
      logger.error('Failed to extract DOCX content with Mammoth', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Parse HTML to structured elements with formatting
   */
  private parseHtmlToElements(html: string): ParsedElement[] {
    const elements: ParsedElement[] = [];
    
    // Normalize HTML: add line breaks after block elements
    let normalizedHtml = html
      .replace(/<\/p>/gi, '</p>\n')
      .replace(/<\/div>/gi, '</div>\n')
      .replace(/<\/h[1-6]>/gi, '</h$1>\n')
      .replace(/<br\s*\/?>/gi, '<br>\n')
      .replace(/<\/li>/gi, '</li>\n')
      .replace(/<\/ul>/gi, '</ul>\n')
      .replace(/<\/ol>/gi, '</ol>\n');
    
    // Split into lines
    const lines = normalizedHtml.split(/\n/);
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (!trimmedLine) {
        continue; // Skip empty lines
      }

      // Check for image
      const imgMatch = trimmedLine.match(/<img[^>]+src="([^"]+)">/);
      if (imgMatch) {
        elements.push({
          type: 'image',
          imageData: imgMatch[1]
        });
        continue;
      }

      // Parse text with formatting
      const segments = this.parseTextSegments(trimmedLine);
      if (segments.length > 0) {
        elements.push({
          type: 'text',
          segments
        });
      }
    }

    return elements;
  }

  /**
   * Parse text segments from HTML line with formatting tags
   */
  private parseTextSegments(htmlLine: string): TextSegment[] {
    const segments: TextSegment[] = [];
    
    // Check for headings
    const headingMatch = htmlLine.match(/<h([1-6])[^>]*>(.*?)<\/h[1-6]>/i);
    if (headingMatch) {
      const level = parseInt(headingMatch[1]);
      const text = this.stripTags(headingMatch[2]);
      if (text.trim()) {
        segments.push({ text, heading: level });
      }
      return segments;
    }

    // Check for list items
    const liMatch = htmlLine.match(/<li[^>]*>(.*?)<\/li>/i);
    if (liMatch) {
      const text = this.stripTags(liMatch[1]);
      if (text.trim()) {
        segments.push({ text, isBullet: true });
      }
      return segments;
    }

    // Check for paragraphs
    const pMatch = htmlLine.match(/<p[^>]*>(.*?)<\/p>/i);
    if (pMatch) {
      return this.parseInlineFormatting(pMatch[1]);
    }

    // Parse any remaining HTML
    return this.parseInlineFormatting(htmlLine);
  }

  /**
   * Parse inline formatting (bold, italic) from HTML
   */
  private parseInlineFormatting(html: string): TextSegment[] {
    const segments: TextSegment[] = [];
    
    // Remove outer whitespace
    html = html.trim();
    
    if (!html) {
      return segments;
    }

    // Pattern to match formatted text or plain text
    // Matches: <strong>...</strong>, <b>...</b>, <em>...</em>, <i>...</i>, or plain text
    const pattern = /<(strong|b|em|i)>(.*?)<\/\1>|([^<]+)/gi;
    let match;
    let hasMatches = false;
    
    while ((match = pattern.exec(html)) !== null) {
      hasMatches = true;
      
      if (match[3]) {
        // Plain text (group 3)
        const text = this.decodeHtmlEntities(match[3]);
        if (text.trim()) {
          segments.push({ text });
        }
      } else if (match[1] && match[2]) {
        // Formatted text (groups 1 and 2)
        const tag = match[1].toLowerCase();
        const innerHtml = match[2];
        
        // Recursively parse in case of nested tags
        const innerText = this.stripTags(innerHtml);
        const text = this.decodeHtmlEntities(innerText);
        
        if (text.trim()) {
          segments.push({
            text,
            bold: tag === 'strong' || tag === 'b',
            italic: tag === 'em' || tag === 'i'
          });
        }
      }
    }

    // Fallback: if no matches, just extract all text
    if (!hasMatches || segments.length === 0) {
      const text = this.decodeHtmlEntities(this.stripTags(html));
      if (text.trim()) {
        segments.push({ text });
      }
    }

    return segments;
  }

  /**
   * Strip HTML tags
   */
  private stripTags(html: string): string {
    return html.replace(/<[^>]+>/g, '').trim();
  }

  /**
   * Decode HTML entities
   */
  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'");
  }

  /**
   * Create formatted PDF from parsed elements
   */
  private async createFormattedPdf(
    elements: ParsedElement[], 
    images: Array<{ id: string; buffer: Buffer; type: string }>,
    fileName: string
  ): Promise<Buffer> {
    try {
      // Create PDF document
      const pdfDoc = await PDFDocument.create();
      pdfDoc.setTitle(fileName);
      pdfDoc.setProducer('Haumea PDF Converter');
      pdfDoc.setCreator('Haumea');

      // Embed fonts
      const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
      const boldItalicFont = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

      // Embed images
      const embeddedImages = new Map<string, PDFImage>();
      for (const img of images) {
        try {
          let pdfImage: PDFImage;
          if (img.type === 'png') {
            pdfImage = await pdfDoc.embedPng(img.buffer);
          } else {
            pdfImage = await pdfDoc.embedJpg(img.buffer);
          }
          embeddedImages.set(img.id, pdfImage);
        } catch (error) {
          logger.warn('Failed to embed image', { imageId: img.id });
        }
      }

    // Page configuration
    const pageWidth = 595; // A4
    const pageHeight = 842;
    const margin = 50;
    const maxWidth = pageWidth - 2 * margin;

    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let yPosition = pageHeight - margin;

    // Process elements
    for (const element of elements) {
      if (element.type === 'break') {
        yPosition -= 10;
        continue;
      }

      if (element.type === 'image' && element.imageData) {
        const pdfImage = embeddedImages.get(element.imageData);
        if (pdfImage) {
          // Calculate image dimensions (max 500px width)
          const imgDims = pdfImage.scale(1);
          const maxImgWidth = Math.min(maxWidth, 500);
          const scale = Math.min(1, maxImgWidth / imgDims.width);
          const scaledWidth = imgDims.width * scale;
          const scaledHeight = imgDims.height * scale;

          // Check if we need a new page
          if (yPosition - scaledHeight < margin) {
            currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
            yPosition = pageHeight - margin;
          }

          // Draw image
          currentPage.drawImage(pdfImage, {
            x: margin,
            y: yPosition - scaledHeight,
            width: scaledWidth,
            height: scaledHeight
          });

          yPosition -= scaledHeight + 15;
        }
        continue;
      }

      if (element.type === 'text' && element.segments) {
        // Process text segments
        for (const segment of element.segments) {
          // Determine font and size
          let font = regularFont;
          let fontSize = 11;
          let lineHeight = 15;

          if (segment.heading) {
            // Headings
            fontSize = 24 - (segment.heading * 2);
            lineHeight = fontSize * 1.3;
            font = boldFont;
          } else if (segment.bold && segment.italic) {
            font = boldItalicFont;
          } else if (segment.bold) {
            font = boldFont;
          } else if (segment.italic) {
            font = italicFont;
          }

          // Add bullet prefix
          let text = segment.text;
          if (segment.isBullet) {
            text = `• ${text}`;
          }

          // Word wrap
          const words = text.split(' ');
          let currentLine = '';

          for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const testWidth = font.widthOfTextAtSize(testLine, fontSize);

            if (testWidth > maxWidth && currentLine) {
              // Draw current line
              if (yPosition < margin) {
                currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
                yPosition = pageHeight - margin;
              }

              currentPage.drawText(currentLine, {
                x: margin,
                y: yPosition,
                size: fontSize,
                font: font,
                color: rgb(0, 0, 0)
              });

              yPosition -= lineHeight;
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          }

          // Draw remaining text
          if (currentLine) {
            if (yPosition < margin) {
              currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
              yPosition = pageHeight - margin;
            }

            currentPage.drawText(currentLine, {
              x: margin,
              y: yPosition,
              size: fontSize,
              font: font,
              color: rgb(0, 0, 0)
            });

            yPosition -= lineHeight;
          }
        }

        // Extra spacing after paragraph
        yPosition -= 5;
      }
    }

      // Serialize PDF
      const pdfBytes = await pdfDoc.save();
      return Buffer.from(pdfBytes);
    } catch (error) {
      logger.error('Error creating formatted PDF', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Convert DOCX buffer directly to PDF
   * For use when you already have the file buffer
   */
  async convertDocxBufferToPdf(docxBuffer: Buffer, fileName: string): Promise<ConversionResult> {
    try {
      logger.info('Converting DOCX buffer to PDF', { fileName });

      // Extract content with mammoth including images
      const extractionResult = await this.extractDocxContent(docxBuffer);
      
      // Parse HTML to structured elements
      const elements = this.parseHtmlToElements(extractionResult.html);

      // Create PDF with formatting and images
      const pdfBuffer = await this.createFormattedPdf(elements, extractionResult.images, fileName);
      const pdfBase64 = pdfBuffer.toString('base64');

      logger.info('PDF created from buffer successfully', { 
        pdfSize: pdfBuffer.length
      });

      return {
        success: true,
        pdfBuffer,
        pdfBase64
      };

    } catch (error) {
      logger.error('Error converting DOCX buffer to PDF', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during conversion'
      };
    }
  }
}

export const docxToPdfService = new DocxToPdfService();
