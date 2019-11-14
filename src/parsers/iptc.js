import {AppSegment, parsers} from './core.js'
import {BufferView} from '../util/BufferView.js'
import {tagKeys, tagValues} from '../tags.js'


/*
http://fileformats.archiveteam.org/wiki/Photoshop_Image_Resources
In a TIFF file, tag 34377 contains Photoshop Image Resources.
In a JPEG file, an APP13 marker with an identifier of "Photoshop 3.0" contains Photoshop Image Resources.
Resource ID 0x0404 contains IPTC data.
Resource ID 0x040c may contain a thumbnail in JPEG/JFIF format.
Resource ID 0x040F contains an ICC profile.
Resource ID 0x0422 contains Exif data.
Resource ID 0x0424 contains XMP data.
*/

export default class Iptc extends AppSegment {

	static type = 'iptc'

	static canHandle(file, offset) {
		return file.getUint8(offset + 1) === 0xED
			&& file.getString(offset + 4, 9) === 'Photoshop'
	}

	static headerLength(file, offset, length) {
		for (let i = 0; i < length; i++) {
			if (this.isIptcSegmentHead(file, offset + i)) {
				// Get the length of the name header (which is padded to an even number of bytes)
				var nameHeaderLength = file.getUint8(offset + i + 7)
				if (nameHeaderLength % 2 !== 0) nameHeaderLength += 1
				// Check for pre photoshop 6 format
				if (nameHeaderLength === 0) nameHeaderLength = 4
				return i + 8 + nameHeaderLength
			}
		}
	}

	static isIptcSegmentHead(chunk, offset) {
		return chunk.getUint8(offset)     === 0x38 // I - photoshop segment start
			&& chunk.getUint8(offset + 1) === 0x42 // B - photoshop segment start
			&& chunk.getUint8(offset + 2) === 0x49 // I - photoshop segment start
			&& chunk.getUint8(offset + 3) === 0x4D // M - photoshop segment start
			&& chunk.getUint8(offset + 4) === 0x04 // IPTC segment head
			&& chunk.getUint8(offset + 5) === 0x04 // IPTC segment head
			// NOTE: theres much more in the Photoshop format than just IPTC
	}

	parse() {
		let dict = tagKeys.iptc
		let iptc = this.output = {}
		let length = this.chunk.byteLength
		for (let offset = 0; offset < length; offset++) {
			// reading Uint8 and then another to prevent unnecessarry read of two subsequent bytes, when iterating
			if (this.chunk.getUint8(offset) === 0x1C && this.chunk.getUint8(offset + 1) === 0x02) {
				let size = this.chunk.getUint16(offset + 3)
				let tag = this.chunk.getUint8(offset + 2)
				let key = dict[tag] || tag // TODO: translate tags on demand
				let val = this.chunk.getString(offset + 5, size)
				iptc[key] = this.setValueOrArrayOfValues(val, iptc[key])
			}
		}
		return this.output
	}

	setValueOrArrayOfValues(newValue, existingValue) {
		if (existingValue !== undefined) {
			if (existingValue instanceof Array) {
				existingValue.push(newValue)
				return existingValue
			} else {
				return [existingValue, newValue]
			}
		} else {
			return newValue
		}
	}

}

parsers.iptc = Iptc 