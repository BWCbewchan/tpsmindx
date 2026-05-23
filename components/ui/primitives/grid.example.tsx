/**
 * Grid Component Examples
 * 
 * This file demonstrates various usage patterns for the Grid primitive component.
 */

import { Grid } from './grid'

export function GridExamples() {
  return (
    <div className="space-y-8 p-8">
      <section>
        <h2 className="text-2xl font-bold mb-4">Grid với 3 cột</h2>
        <Grid cols={3} gap="lg">
          <div className="bg-gray-100 p-4 rounded">Mục 1</div>
          <div className="bg-gray-100 p-4 rounded">Mục 2</div>
          <div className="bg-gray-100 p-4 rounded">Mục 3</div>
          <div className="bg-gray-100 p-4 rounded">Mục 4</div>
          <div className="bg-gray-100 p-4 rounded">Mục 5</div>
          <div className="bg-gray-100 p-4 rounded">Mục 6</div>
        </Grid>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Grid với 4 cột và khoảng cách nhỏ</h2>
        <Grid cols={4} gap="sm">
          <div className="bg-blue-100 p-4 rounded">A</div>
          <div className="bg-blue-100 p-4 rounded">B</div>
          <div className="bg-blue-100 p-4 rounded">C</div>
          <div className="bg-blue-100 p-4 rounded">D</div>
        </Grid>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Grid với 2 cột</h2>
        <Grid cols={2} gap="md">
          <div className="bg-green-100 p-4 rounded">
            <h3 className="font-semibold">Tiêu đề 1</h3>
            <p>Nội dung mô tả cho mục 1</p>
          </div>
          <div className="bg-green-100 p-4 rounded">
            <h3 className="font-semibold">Tiêu đề 2</h3>
            <p>Nội dung mô tả cho mục 2</p>
          </div>
        </Grid>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Grid 12 cột (layout phức tạp)</h2>
        <Grid cols={12} gap="md">
          <div className="col-span-8 bg-purple-100 p-4 rounded">
            Nội dung chính (8 cột)
          </div>
          <div className="col-span-4 bg-purple-100 p-4 rounded">
            Thanh bên (4 cột)
          </div>
          <div className="col-span-4 bg-purple-100 p-4 rounded">
            Mục 1 (4 cột)
          </div>
          <div className="col-span-4 bg-purple-100 p-4 rounded">
            Mục 2 (4 cột)
          </div>
          <div className="col-span-4 bg-purple-100 p-4 rounded">
            Mục 3 (4 cột)
          </div>
        </Grid>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Grid không có khoảng cách</h2>
        <Grid cols={3} gap="none">
          <div className="bg-red-100 p-4 border">1</div>
          <div className="bg-red-100 p-4 border">2</div>
          <div className="bg-red-100 p-4 border">3</div>
        </Grid>
      </section>
    </div>
  )
}
